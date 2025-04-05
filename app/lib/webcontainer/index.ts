import { WebContainer } from '@webcontainer/api';
import { PreviewMessageType } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

// Track common error patterns to provide better error messages
const ERROR_PATTERNS = {
  MODULE_NOT_FOUND: {
    pattern: /Cannot find module '([^']+)'/,
    friendlyMessage: (module: string) =>
      `Missing dependency: '${module}' not found. Try installing it with 'npm install ${module}'.`,
  },
  SYNTAX_ERROR: {
    pattern: /SyntaxError: (.*)/,
    friendlyMessage: (details: string) => `Syntax error: ${details}`,
  },
  TYPE_ERROR: {
    pattern: /TypeError: (.*)/,
    friendlyMessage: (details: string) => `Type error: ${details}`,
  },
  REFERENCE_ERROR: {
    pattern: /ReferenceError: (.*)/,
    friendlyMessage: (details: string) => `Reference error: ${details}`,
  },
  PORT_IN_USE: {
    pattern: /EADDRINUSE: address already in use/i,
    friendlyMessage: () => `Port already in use - another server is already running`,
  },
};

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

// Helper function to extract useful information from the error
function enrichErrorInfo(
  message: string,
  stack: string,
): {
  errorType: string;
  enhancedMessage: string;
  relevantCode?: string;
  suggestedFix?: string;
} {
  // Default values
  let errorType = 'Runtime Error';
  let enhancedMessage = message;
  let relevantCode: string | undefined = undefined;
  let suggestedFix: string | undefined = undefined;

  // Check for known error patterns
  for (const [key, errorInfo] of Object.entries(ERROR_PATTERNS)) {
    const match = message.match(errorInfo.pattern);

    if (match) {
      errorType = key;
      enhancedMessage = errorInfo.friendlyMessage(match[1]);

      // For module not found, suggest installing
      if (key === 'MODULE_NOT_FOUND') {
        suggestedFix = `Run: npm install ${match[1]}`;
      }

      break;
    }
  }

  // Try to extract code snippet from stack trace if available
  const codeLineMatch = stack.match(/at .*\(.*:(\d+):(\d+)\)/);

  if (codeLineMatch) {
    const stackLines = stack.split('\n');

    // Look for code snippets that might be in the stack trace
    for (const line of stackLines) {
      if (line.trim().startsWith('> ')) {
        relevantCode = line.trim();
        break;
      }
    }
  }

  return { errorType, enhancedMessage, relevantCode, suggestedFix };
}

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({
          coep: 'credentialless',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        webcontainerContext.loaded = true;

        const { workbenchStore } = await import('~/lib/stores/workbench');

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('WebContainer preview message:', message);

          // Handle specific error types
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            const cleanedStack = cleanStackTrace(message.stack || '');

            // Analyze the error to provide enhanced context
            const { errorType, enhancedMessage, relevantCode, suggestedFix } = enrichErrorInfo(
              message.message,
              cleanedStack,
            );

            // Build a more informative error message
            let errorContent = `Error type: ${errorType}\n`;
            errorContent += `Location: ${message.pathname}${message.search}${message.hash}\n`;
            errorContent += `Port: ${message.port}\n\n`;

            if (relevantCode) {
              errorContent += `Code: ${relevantCode}\n\n`;
            }

            errorContent += `Stack trace:\n${cleanedStack}\n`;

            if (suggestedFix) {
              errorContent += `\nSuggested fix: ${suggestedFix}`;
            }

            workbenchStore.actionAlert.set({
              type: 'preview',
              title: isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception',
              description: enhancedMessage,
              content: errorContent,
              source: 'preview',
            });
          } else if (message.type === PreviewMessageType.ConsoleError) {
            // Handle console errors from preview
            workbenchStore.actionAlert.set({
              type: 'preview',
              title: 'Console Error',
              description: message.args?.[0]?.toString() || 'Error in console',
              content: `Console error in preview:\n${message.args?.map((arg) => String(arg)).join(' ') || 'Unknown error'}\n\nStack: ${message.stack || 'No stack trace available'}`,
              source: 'preview',
            });
          }
        });

        // Listen for general WebContainer errors
        webcontainer.on('error', (error) => {
          console.error('WebContainer error:', error);

          workbenchStore.actionAlert.set({
            type: 'error',
            title: 'WebContainer Error',
            description: error.message || 'An error occurred in the WebContainer',
            content: `Error: ${error.message || 'Unknown error'}\n\nStack: ${(error as any).stack || 'No stack trace available'}`,
            source: 'terminal',
          });
        });

        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}

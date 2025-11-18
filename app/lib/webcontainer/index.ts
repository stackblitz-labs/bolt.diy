import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

interface WebContainerContext {
  loaded: boolean;
  scriptsInjected: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
  scriptsInjected: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

// Function to inject preview scripts into WebContainer
async function injectPreviewScripts(container: WebContainer) {
  if (webcontainerContext.scriptsInjected) {
    console.log('[WebContainer] Scripts already injected, skipping');
    return;
  }

  console.log('[WebContainer] Injecting preview scripts');

  const [inspectorResponse, visualEditorResponse] = await Promise.all([
    fetch('/inspector-script.js'),
    fetch('/visual-editor-script.js'),
  ]);

  const inspectorScript = await inspectorResponse.text();
  const visualEditorScript = await visualEditorResponse.text();
  const combinedScript = `${inspectorScript}\n\n${visualEditorScript}`;

  await container.setPreviewScript(combinedScript);
  webcontainerContext.scriptsInjected = true;

  console.log('[WebContainer] Preview scripts injected successfully');
}

// Function to re-inject preview scripts (can be called manually)
export async function reinjectPreviewScripts() {
  console.log('[WebContainer] Re-injecting preview scripts');
  webcontainerContext.scriptsInjected = false;

  const container = await webcontainer;
  await injectPreviewScripts(container);
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

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

        // Inject preview scripts
        await injectPreviewScripts(webcontainer);

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('WebContainer preview message:', message);

          // Handle both uncaught exceptions and unhandled promise rejections
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
            workbenchStore.actionAlert.set({
              type: 'preview',
              title,
              description: 'message' in message ? message.message : 'Unknown error',
              content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
              source: 'preview',
            });
          }
        });

        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}

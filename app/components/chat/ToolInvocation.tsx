import { AnimatePresence, motion } from 'framer-motion';
import { memo, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import type { ToolInvocationAnnotation } from '~/types/context';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';

const highlighterOptions = {
  langs: ['json'],
  themes: ['light-plus', 'dark-plus'],
};

const jsonHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.jsonHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.jsonHighlighter = jsonHighlighter;
}

interface ToolInvocationProps {
  toolInvocations: ToolInvocationAnnotation[];
}

export const ToolInvocation = memo(({ toolInvocations }: ToolInvocationProps) => {
  const userToggledDetails = useRef(false);
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => {
    userToggledDetails.current = true;
    setShowDetails(!showDetails);
  };

  if (toolInvocations.length === 0) {
    return null;
  }

  return (
    <div className="tool-invocation border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-lg w-full transition-border duration-150 mt-4">
      <div className="flex">
        <button
          className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
          onClick={toggleDetails}
        >
          <div className="p-4">
            <div className={'i-ph:wrench'} style={{ fontSize: '2rem' }}></div>
          </div>
          <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
          <div className="px-5 p-3.5 w-full text-left">
            <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">
              MCP Tool Invocations
            </div>
            <div className="w-full w-full text-bolt-elements-textSecondary text-xs mt-0.5">
              {toolInvocations.length} tool{toolInvocations.length > 1 ? 's' : ''} used
            </div>
          </div>
        </button>
        <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          <motion.button
            initial={{ width: 0 }}
            animate={{ width: 'auto' }}
            exit={{ width: 0 }}
            transition={{ duration: 0.15, ease: cubicEasingFn }}
            className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
            onClick={toggleDetails}
          >
            <div className="p-4">
              <div className={showDetails ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
            </div>
          </motion.button>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="details"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

            <div className="p-5 text-left bg-bolt-elements-actions-background">
              <ToolList toolInvocations={toolInvocations} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface JsonCodeBlockProps {
  className?: string;
  code: string;
}

function JsonCodeBlock({ className, code }: JsonCodeBlockProps) {
  let formattedCode = code;

  try {
    if (typeof code !== 'string') {
      formattedCode = JSON.stringify(code, null, 2);
    } else if (!code.trim().startsWith('{') && !code.trim().startsWith('[')) {
      // Not JSON, keep as is
    } else {
      formattedCode = JSON.stringify(JSON.parse(code), null, 2);
    }
  } catch (e) {
    // If parsing fails, keep original code
    logger.error('Failed to parse JSON', { error: e });
  }

  return (
    <div
      className={classNames('text-xs rounded-md overflow-hidden', className)}
      dangerouslySetInnerHTML={{
        __html: jsonHighlighter.codeToHtml(formattedCode, {
          lang: 'json',
          theme: 'dark-plus',
        }),
      }}
      style={{
        padding: '0',
        margin: '0',
      }}
    ></div>
  );
}

interface ToolListProps {
  toolInvocations: ToolInvocationAnnotation[];
}

const toolVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const ToolList = memo(({ toolInvocations }: ToolListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-4">
        {toolInvocations.map((tool, index) => {
          const isLast = index === toolInvocations.length - 1;

          return (
            <motion.li
              key={index}
              variants={toolVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm mb-2">
                <div className="text-lg text-bolt-elements-icon-success">
                  <div className="i-ph:check"></div>
                </div>
                <div className="font-semibold">{tool.toolName}</div>
              </div>

              <div className="ml-6 mb-2">
                <div className="text-bolt-elements-textSecondary text-xs mb-1">Parameters:</div>
                <div className="bg-[#1E1E1E] p-3 rounded-md">
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(tool.parameters)} />
                </div>

                <div className="text-bolt-elements-textSecondary text-xs mt-3 mb-1">Result:</div>
                <div
                  className={classNames('bg-[#1E1E1E] p-3 rounded-md', {
                    'mb-3.5': !isLast,
                  })}
                >
                  <JsonCodeBlock className="mb-0" code={JSON.stringify(tool.result)} />
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

import { useStore } from '@nanostores/react';
import { motion, type Variants } from 'framer-motion';
import { memo } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { Preview } from './Preview/Preview';
import useViewport from '~/lib/hooks';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { useLayoutWidths } from '~/lib/hooks/useLayoutWidths';
import { userStore } from '~/lib/stores/userAuth';

interface WorkspaceProps {
  chatStarted?: boolean;
  handleSendMessage: (params: ChatMessageParams) => void;
}

const createWorkbenchVariants = (workbenchWidth: number) =>
  ({
    closed: {
      width: 0,
      transition: {
        duration: 0.2,
        ease: cubicEasingFn,
      },
    },
    open: {
      width: workbenchWidth,
      transition: {
        duration: 0.2,
        ease: cubicEasingFn,
      },
    },
  }) satisfies Variants;

export const Workbench = memo(({ chatStarted, handleSendMessage }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const user = useStore(userStore.user);
  const { workbenchWidth, workbenchLeft } = useLayoutWidths(!!user);
  const workbenchVariants = createWorkbenchVariants(workbenchWidth);

  const isSmallViewport = useViewport(800);

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames('fixed mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier', {
            'top-[calc(var(--header-height)+0rem)] bottom-13': isSmallViewport,
            'top-[calc(var(--header-height)+1.5rem)] bottom-6': !isSmallViewport,
            'w-full': isSmallViewport,
            'left-0': showWorkbench && isSmallViewport,
            'left-[100%]': !showWorkbench,
          })}
          style={
            !isSmallViewport
              ? {
                  width: `${workbenchWidth}px`,
                  left: showWorkbench ? `${workbenchLeft}px` : '100%',
                }
              : undefined
          }
        >
          <div
            className={classNames('absolute inset-0', {
              'lg:px-6': !isSmallViewport,
            })}
          >
            <div
              className={classNames(
                'h-full flex flex-col bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor shadow-lg overflow-hidden',
                {
                  'rounded-xl': !isSmallViewport,
                },
              )}
            >
              <div className="relative flex-1 overflow-hidden">
                <Preview handleSendMessage={handleSendMessage} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  );
});

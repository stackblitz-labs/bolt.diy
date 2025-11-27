import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '~/lib/utils';

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'group relative flex w-1 items-center justify-center bg-transparent focus-visible:outline-none',
      'data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-full',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div
        className={cn(
          'absolute inset-y-6 w-[2px] rounded-full',
          'bg-transparent transition-all duration-200 ease-out',
          'group-hover:bg-bolt-elements-textTertiary/50',
          'group-active:bg-bolt-elements-textSecondary/60 group-active:w-[3px]',
          'data-[panel-group-direction=vertical]:inset-y-0 data-[panel-group-direction=vertical]:inset-x-6',
          'data-[panel-group-direction=vertical]:h-[2px] data-[panel-group-direction=vertical]:w-auto',
        )}
      />
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

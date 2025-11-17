import { Skeleton } from './Skeleton';
import { VerticalNav } from '~/components/header/VerticalNav';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '~/components/ui/resizable';
import { ClientOnly } from 'remix-utils/client-only';
import { getDefaultChatPanelSize } from '~/lib/utils/panelSizes';

export const AppSkeleton = () => {
  return (
    <div className="h-full w-full flex flex-col bg-bolt-elements-background-depth-1">
      {/* Vertical Nav */}
      <div className="fixed left-0 top-0 bottom-0 z-30">
        <ClientOnly>{() => <VerticalNav />}</ClientOnly>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full ml-16">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={getDefaultChatPanelSize()} minSize={30} maxSize={60} className="relative">
            <div className="w-full h-full pl-0 pr-1 py-2">
              <div className="flex flex-col h-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor overflow-hidden">
                {/* Chat Header */}
                <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
                  <div className="flex items-center gap-2 px-4 h-[38px]">
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {/* Message skeletons */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <div className="ml-11 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/6" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Workbench Panel */}
          <ResizablePanel defaultSize={100 - getDefaultChatPanelSize()} minSize={40} className="relative">
            <div className="w-full h-full pl-1 pr-0 py-2">
              <div className="h-full flex flex-col bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor overflow-hidden">
                {/* Workbench Header */}
                <div className="flex-shrink-0 px-4 h-[38px] flex items-center gap-2 border-b border-bolt-elements-borderColor border-opacity-50">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>

                {/* Preview Area */}
                <div className="flex-1 overflow-hidden">
                  <div className="h-full flex flex-col">
                    {/* URL Bar */}
                    <div className="flex-shrink-0 px-4 h-[38px] flex items-center gap-2 border-b border-bolt-elements-borderColor border-opacity-50">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 flex-1 max-w-md" />
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-4 rounded" />
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 bg-bolt-elements-background-depth-2">
                      <Skeleton className="h-full w-full rounded-b-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

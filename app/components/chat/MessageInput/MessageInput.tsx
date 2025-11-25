import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { SendButton } from '~/components/chat/SendButton.client';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { getDiscoveryRating } from '~/lib/persistence/message';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbEllipsis,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { buildBreadcrumbData } from '~/utils/componentBreadcrumb';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { userStore } from '~/lib/stores/auth';
import { useIsMobile } from '~/lib/hooks/useIsMobile';
import { processImage, validateImageFile, formatFileSize } from '~/utils/imageProcessing';
import { toast } from 'react-toastify';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { getCurrentIFrame } from '~/components/workbench/Preview/Preview';
import { Crosshair, Paperclip, X, Palette } from 'lucide-react';
import { buildAccessStore } from '~/lib/stores/buildAccess';
import { designPanelStore } from '~/lib/stores/designSystemStore';

interface ReactComponent {
  displayName?: string;
  name?: string;
  props?: Record<string, unknown>;
  state?: unknown;
  type: 'class' | 'function' | 'host';
  selector?: string;
  source?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

interface SelectedElementData {
  component: ReactComponent | null;
  tree: ReactComponent[];
}

export interface MessageInputProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  input?: string;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSendMessage?: (params: ChatMessageParams) => void;
  handleStop?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  isListening?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  minHeight?: number;
  maxHeight?: number;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  textareaRef,
  input = '',
  handleInputChange = () => {},
  handleSendMessage = () => {},
  handleStop = () => {},
  uploadedFiles = [],
  setUploadedFiles = () => {},
  imageDataList = [],
  setImageDataList = () => {},
  isListening = false,
  onStartListening = () => {},
  onStopListening = () => {},
  minHeight = 76,
  maxHeight = 200,
}) => {
  const hasPendingMessage = useStore(chatStore.hasPendingMessage);
  const chatStarted = useStore(chatStore.started);
  const messages = useStore(chatStore.messages);
  const appSummary = useStore(chatStore.appSummary);
  const hasAppSummary = !!appSummary;
  const user = useStore(userStore);
  const selectedElement = useStore(workbenchStore.selectedElement) as SelectedElementData | null;
  const { isMobile, isTablet } = useIsMobile();
  const hasBuildAccess = useStore(buildAccessStore.hasAccess);
  const isDesignPanelVisible = useStore(designPanelStore.isVisible);

  // Helper functions for element highlighting
  const highlightElement = (component: ReactComponent) => {
    const iframe = getCurrentIFrame();
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    // Use the specific CSS selector if available, otherwise fall back to tag name
    const selector =
      component.selector ||
      (component.type === 'host' ? (component.displayName || component.name)?.toLowerCase() : null);
    const selectorParts = selector?.split('> ');
    if (selector) {
      iframe.contentWindow.postMessage(
        {
          type: 'ELEMENT_PICKER_HIGHLIGHT',
          selector: selectorParts?.[selectorParts.length - 1],
        },
        '*',
      );
    }
  };

  const clearHighlight = () => {
    const iframe = getCurrentIFrame();
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    iframe.contentWindow.postMessage(
      {
        type: 'ELEMENT_PICKER_HIGHLIGHT',
        selector: null,
      },
      '*',
    );
  };

  // Helper function to update when clicking breadcrumb items (sets clicked component as selected and trims tree)
  const updateTreeToComponent = (clickedComponent: ReactComponent, tree: ReactComponent[]) => {
    const clickedIndex = tree.indexOf(clickedComponent);
    if (clickedIndex === -1) {
      return;
    }

    // Tree is ordered from deepest node to root, so trim everything below the clicked node
    const newTree = tree.slice(clickedIndex);
    const lastReactComponent = [...newTree]
      .reverse()
      .find((comp: ReactComponent) => comp.type === 'function' || comp.type === 'class');

    workbenchStore.setSelectedElement({
      component: lastReactComponent ?? clickedComponent,
      tree: newTree,
    });
  };

  let startPlanningRating = 0;
  if (!hasPendingMessage && !hasAppSummary) {
    startPlanningRating = getDiscoveryRating(messages || []);
  }

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      await processUploadedFile(file);
    };

    input.click();
  };

  const processUploadedFile = async (file: File) => {
    // Validate the file
    const validation = validateImageFile(file);

    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid image file');
      return;
    }

    // Show processing toast for large files
    const originalSizeKB = Math.round(file.size / 1024);

    if (originalSizeKB > 500 || validation.canConvert) {
      toast.info(
        validation.canConvert
          ? `Converting ${file.type} to JPEG...`
          : `Optimizing image (${formatFileSize(originalSizeKB)})...`,
      );
    }

    try {
      // Process the image with higher quality settings
      const processed = await processImage(file, {
        maxSizeKB: 500, // Target 450-500KB range
        maxWidth: 2048, // Higher resolution to preserve detail
        maxHeight: 1536, // Higher resolution to preserve detail
        quality: 0.9, // Start with higher quality
        targetFormat: 'jpeg',
      });

      // Show success message if image was processed
      if (processed.wasProcessed) {
        const savedKB = processed.originalSize - processed.processedSize;
        const savedPercent = Math.round((savedKB / processed.originalSize) * 100);

        toast.success(
          `Image optimized! Reduced from ${formatFileSize(processed.originalSize)} to ${formatFileSize(processed.processedSize)} (${savedPercent}% smaller)`,
        );
      }

      // Add to uploaded files
      setUploadedFiles([...uploadedFiles, processed.file]);
      setImageDataList([...imageDataList, processed.dataURL]);
    } catch (error) {
      console.error('Image processing failed:', error);

      // Offer fallback: upload original image if it's not too large
      if (originalSizeKB <= 500) {
        toast.error(
          `Processing failed, but uploading original image (${formatFileSize(originalSizeKB)}). Some features may not work optimally.`,
        );

        // Upload original file as fallback
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Image = e.target?.result as string;
          setUploadedFiles([...uploadedFiles, file]);
          setImageDataList([...imageDataList, base64Image]);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error(
          error instanceof Error
            ? `Failed to process image: ${error.message}. File too large (${formatFileSize(originalSizeKB)})`
            : `Failed to process image. File too large (${formatFileSize(originalSizeKB)})`,
        );
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;

    if (!items) {
      return;
    }

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          await processUploadedFile(file);
        }

        break;
      }
    }
  };

  const handleStartBuilding = () => {
    const message = (input + '\n\nStart building the app based on these requirements.').trim();

    // Transform selectedElement to API format
    const componentReference = selectedElement?.tree
      ? { componentNames: selectedElement.tree.map((comp: ReactComponent) => comp.displayName || 'Anonymous') }
      : undefined;

    handleSendMessage({
      messageInput: message,
      chatMode: ChatMode.DevelopApp,
      componentReference,
    });

    // Clear selected element after sending
    if (selectedElement) {
      workbenchStore.setSelectedElement(null);
    }

    if (window.analytics) {
      window.analytics.track('Clicked Start Building button', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        email: user?.email,
      });
    }

    setTimeout(() => {
      workbenchStore.setShowWorkbench(true);
      mobileNavStore.setShowMobileNav(true);
      mobileNavStore.setActiveTab('preview');
    }, 2000);
  };

  return (
    <div
      className={classNames(
        'relative bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor backdrop-blur rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-bolt-elements-focus/30',
      )}
    >
      {selectedElement && (
        <div className="bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Crosshair size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {(() => {
                    if (!selectedElement.tree || selectedElement.tree.length === 0) {
                      return (
                        <span className="flex items-center gap-1.5">
                          <span className="text-bolt-elements-textPrimary">Selected:</span>
                          <span className="text-blue-600 dark:text-blue-400">
                            {selectedElement.component?.displayName || 'Component'}
                          </span>
                        </span>
                      );
                    }

                    const originalTree = selectedElement.tree;
                    const breadcrumbData = buildBreadcrumbData(originalTree, {
                      getDisplayName: (comp) => comp.displayName || comp.name,
                      getKind: (comp) => (comp.type === 'function' || comp.type === 'class' ? 'react' : 'html'),
                    });

                    if (!breadcrumbData) {
                      return null;
                    }

                    const { htmlElements, firstReact, lastReact, lastHtml } = breadcrumbData;
                    const lastReactComponent = lastReact?.item as ReactComponent | undefined;
                    const firstReactComponent = firstReact?.item as ReactComponent | undefined;
                    const lastHtmlComponent = lastHtml?.item as ReactComponent | undefined;
                    const lastReactDisplayName = lastReact?.displayName;
                    const firstReactDisplayName = firstReact?.displayName;

                    return (
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <span className="text-bolt-elements-textPrimary">Selected:</span>
                          </BreadcrumbItem>

                          {/* Show currently selected React component (last React component) */}
                          {lastReactComponent &&
                            firstReactComponent &&
                            lastReactDisplayName !== firstReactDisplayName && (
                              <>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                  <BreadcrumbPage
                                    className="text-blue-600 dark:text-blue-400 cursor-pointer"
                                    onMouseEnter={() => highlightElement(lastReactComponent)}
                                    onMouseLeave={clearHighlight}
                                    onClick={() => updateTreeToComponent(lastReactComponent, originalTree)}
                                  >
                                    {lastReactDisplayName?.split('$')[0] ||
                                      lastReactDisplayName ||
                                      lastReactComponent.name ||
                                      'Component'}
                                  </BreadcrumbPage>
                                </BreadcrumbItem>
                              </>
                            )}

                          {/* Second ellipsis for HTML elements (if there are any) */}
                          {htmlElements.length > 1 && (
                            <>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="flex items-center gap-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg p-1">
                                    <BreadcrumbEllipsis className="h-4 w-4" />
                                    <span className="sr-only">More HTML elements</span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {htmlElements.slice(1, -1).map((node, index: number) => {
                                      const component = node.item as ReactComponent;

                                      return (
                                        <DropdownMenuItem
                                          key={index}
                                          className="text-purple-600 dark:text-purple-400 cursor-pointer"
                                          onMouseEnter={() => highlightElement(component)}
                                          onMouseLeave={clearHighlight}
                                          onClick={() => updateTreeToComponent(component, originalTree)}
                                        >
                                          {node.displayName || component.name || 'unknown'}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </BreadcrumbItem>
                            </>
                          )}

                          {/* Show currently selected HTML element (last HTML element) */}
                          {lastHtmlComponent && (
                            <>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <BreadcrumbPage
                                  className="text-purple-600 dark:text-purple-400 cursor-pointer"
                                  onMouseEnter={() => highlightElement(lastHtmlComponent)}
                                  onMouseLeave={clearHighlight}
                                  onClick={() => updateTreeToComponent(lastHtmlComponent, originalTree)}
                                >
                                  {lastHtml?.displayName || lastHtmlComponent.name || 'element'}
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                            </>
                          )}
                        </BreadcrumbList>
                      </Breadcrumb>
                    );
                  })()}
                </div>
              </div>
            </div>
            <button
              onClick={() => workbenchStore.setSelectedElement(null)}
              className="w-6 h-6 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-4 hover:border-bolt-elements-focus/50 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          className={classNames(
            'w-full px-6 py-4 pr-20 border-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-base',
            'transition-all duration-200',
            'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50',
            { 'animate-pulse': !input && !chatStarted },
            { 'opacity-50 cursor-not-allowed': hasPendingMessage },
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.boxShadow = 'none';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.boxShadow = 'none';

            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = (e) => {
                  const base64Image = e.target?.result as string;
                  setUploadedFiles([...uploadedFiles, file]);
                  setImageDataList([...imageDataList, base64Image]);
                };
                reader.readAsDataURL(file);
              }
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (hasPendingMessage) {
                chatStore.showStopConfirmation.set(true);
                return;
              }

              if (event.nativeEvent.isComposing) {
                return;
              }

              // Transform selectedElement to API format
              const componentReference = selectedElement?.tree
                ? {
                    componentNames: selectedElement.tree.map((comp: ReactComponent) => comp.displayName || 'Anonymous'),
                  }
                : undefined;

              handleSendMessage({
                messageInput: input,
                chatMode: ChatMode.UserMessage,
                componentReference,
              });

              // Clear selected element after sending
              if (selectedElement) {
                workbenchStore.setSelectedElement(null);
              }
            }
          }}
          value={input}
          onChange={handleInputChange}
          onPaste={handlePaste}
          style={{
            minHeight,
            maxHeight,
            overflowY: 'auto',
          }}
          disabled={hasPendingMessage}
          placeholder={
            !chatStarted
              ? '✨ What do you want to build? Start typing here...'
              : getPlaceholderText(chatStarted, hasAppSummary)
          }
          translate="no"
        />

        {(() => {
          const showSendButton = (hasPendingMessage || input.length > 0 || uploadedFiles.length > 0) && chatStarted;
          const showStartBuildingButton =
            user && startPlanningRating > 0 && !showSendButton && !hasAppSummary && hasBuildAccess;

          return (
            <>
              {showSendButton && (
                <ClientOnly>
                  {() => (
                    <SendButton
                      handleStop={handleStop}
                      handleSendMessage={handleSendMessage}
                      input={input}
                      uploadedFiles={uploadedFiles}
                    />
                  )}
                </ClientOnly>
              )}

              {showStartBuildingButton && (
                <ClientOnly>
                  {() => (
                    <StartBuildingButton onClick={handleStartBuilding} startPlanningRating={startPlanningRating} />
                  )}
                </ClientOnly>
              )}
            </>
          );
        })()}
      </div>

      <div className="flex justify-between items-center rounded-b-2xl px-4 py-3">
        <div className="flex gap-2 items-center">
          {!isMobile && !isTablet && (
            <TooltipProvider>
              <WithTooltip tooltip={isListening ? 'Stop listening' : 'Start speech recognition'}>
                <div>
                  <SpeechRecognitionButton
                    isListening={isListening}
                    onStart={onStartListening}
                    onStop={onStopListening}
                    disabled={hasPendingMessage}
                  />
                </div>
              </WithTooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <WithTooltip
              tooltip={
                <div className="text-xs">
                  <div className="font-medium mb-1 text-bolt-elements-textHeading">Upload Image</div>
                  <div>✅ Supports: JPEG, PNG, GIF, WebP</div>
                  <div>🔄 Converts: SVG, BMP, TIFF → JPEG</div>
                  <div>📐 Auto-resizes large images (&gt;500KB)</div>
                </div>
              }
            >
              <button
                className="w-8 h-8 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-4 hover:border-bolt-elements-focus/50 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                onClick={handleFileUpload}
              >
                <Paperclip size={18} />
              </button>
            </WithTooltip>
          </TooltipProvider>

          {chatStarted && (
            <>
              {!isMobile && !isTablet && <div className="w-px h-5 bg-bolt-elements-borderColor" />}
              <TooltipProvider>
                <WithTooltip
                  tooltip={
                    hasPendingMessage
                      ? 'Design panel is disabled while generating code'
                      : isDesignPanelVisible
                        ? 'Hide Design Panel'
                        : 'Show Design Panel'
                  }
                >
                  <button
                    className={classNames(
                      'w-8 h-8 rounded-lg border transition-all duration-200 flex items-center justify-center',
                      hasPendingMessage
                        ? 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary opacity-50 cursor-not-allowed'
                        : isDesignPanelVisible
                          ? 'bg-bolt-elements-background-depth-4 border-bolt-elements-focus/50 text-bolt-elements-textPrimary'
                          : 'bg-bolt-elements-background-depth-3 border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-4 hover:border-bolt-elements-focus/50 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    )}
                    onClick={() => {
                      if (!hasPendingMessage) {
                        designPanelStore.isVisible.set(!isDesignPanelVisible);
                      }
                    }}
                    disabled={hasPendingMessage}
                  >
                    <Palette size={18} />
                  </button>
                </WithTooltip>
              </TooltipProvider>
            </>
          )}
        </div>

        {input.length > 3 && (
          <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
            <span>Press</span>
            <kbd className="px-2 py-1 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor font-mono text-xs">
              Shift
            </kbd>
            <span>+</span>
            <kbd className="px-2 py-1 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor font-mono text-xs">
              ↵
            </kbd>
            <span>for new line</span>
          </div>
        )}
      </div>
    </div>
  );
};

function getPlaceholderText(chatStarted: boolean, hasAppSummary: boolean) {
  if (!chatStarted) {
    // There is no app and no messages have been sent yet.
    return 'What do you want to build?';
  }

  if (!hasAppSummary) {
    // We've started discovery but haven't started building yet.
    return "Is there anything else you'd like me to know?";
  }

  // We have an app that is being iterated on.
  return 'How can we help you?';
}

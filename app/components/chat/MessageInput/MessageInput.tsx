import React, { useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { getDiscoveryRating } from '~/lib/persistence/message';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
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
import { processImage, validateImageFile, formatFileSize } from '~/utils/imageProcessing';
import { toast } from 'react-toastify';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { getCurrentIFrame } from '~/components/workbench/Preview/Preview';
import {
  Crosshair,
  X,
  Plus,
  ChevronRight,
  // Mic,
} from 'lucide-react';
import { Button } from '~/components/ui/button';

// const AudioWaveIcon = () => (
//   <svg
//     width="16"
//     height="16"
//     viewBox="0 0 16 16"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//     className="#F97391"
//   >
//     <path
//       d="M3 6V10M5.5 5V11M8 3V13M10.5 5V11M13 6V10"
//       stroke="#F97391"
//       strokeWidth="1.5"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     />
//   </svg>
// )

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
  // handleStop = () => {},
  uploadedFiles = [],
  setUploadedFiles = () => {},
  imageDataList = [],
  setImageDataList = () => {},
  // isListening = false,
  // onStartListening = () => {},
  // onStopListening = () => {},
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

  // Focus textarea if URL has focus=true parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('focus') === 'true' && textareaRef?.current) {
      textareaRef.current.focus();
    }
  }, [textareaRef]);

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

  // Listen for messages from iframe
  // useEffect(() => {
  //   const handleMessage = (event: MessageEvent) => {
  //     if (event.data.type === 'ELEMENT_PICKED') {
  //       // Store the full element data including the react tree
  //       workbenchStore.setSelectedElement({
  //         component: event.data.react.component,
  //         tree: event.data.react.tree,
  //       });
  //       setIsElementPickerEnabled(false);
  //     } else if (event.data.type === 'ELEMENT_PICKER_STATUS') {
  //     } else if (event.data.type === 'ELEMENT_PICKER_READY' && event.data.source === 'element-picker') {
  //       setIsElementPickerReady(true);
  //     }
  //   };

  //   window.addEventListener('message', handleMessage);
  //   return () => window.removeEventListener('message', handleMessage);
  // }, []);

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
      mobileNavStore.setActiveTab('canvas');
    }, 2000);
  };

  return (
    <div className={classNames('relative transition-all duration-300')}>
      {/* Main input container with white background */}
      <div className="bg-background rounded-md border border-bolt-elements-borderColor">
        {/* Textarea area */}
        <div className="relative">
          {/* Breadcrumb pill at top left */}
          {selectedElement && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-bolt-elements-background-depth-1 rounded-md border border-bolt-elements-borderColor text-sm font-medium">
              <Crosshair size={12} className="text-bolt-elements-textSecondary flex-shrink-0" />
              {(() => {
                if (!selectedElement.tree || selectedElement.tree.length === 0) {
                  return (
                    <span className="text-bolt-elements-textPrimary font-medium">
                      {selectedElement.component?.displayName || 'Component'}
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

                const parts: React.ReactNode[] = [];

                // Show currently selected React component (last React component)
                if (lastReactComponent && firstReactComponent && lastReactDisplayName !== firstReactDisplayName) {
                  parts.push(
                    <button
                      key="react"
                      className="text-bolt-elements-textPrimary hover:text-bolt-elements-textHeading transition-colors cursor-pointer"
                      onMouseEnter={() => highlightElement(lastReactComponent)}
                      onMouseLeave={clearHighlight}
                      onClick={() => updateTreeToComponent(lastReactComponent, originalTree)}
                    >
                      {lastReactDisplayName?.split('$')[0] ||
                        lastReactDisplayName ||
                        lastReactComponent.name ||
                        'Component'}
                    </button>,
                  );
                }

                // Show ellipsis for HTML elements (if there are any)
                if (htmlElements.length > 1) {
                  parts.push(
                    <DropdownMenu key="ellipsis">
                      <DropdownMenuTrigger className="flex items-center gap-0.5 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors cursor-pointer">
                        <span>...</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {htmlElements.slice(1, -1).map((node, index: number) => {
                          const component = node.item as ReactComponent;

                          return (
                            <DropdownMenuItem
                              key={index}
                              className="cursor-pointer"
                              onMouseEnter={() => highlightElement(component)}
                              onMouseLeave={clearHighlight}
                              onClick={() => updateTreeToComponent(component, originalTree)}
                            >
                              {node.displayName || component.name || 'unknown'}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>,
                  );
                }

                // Show currently selected HTML element (last HTML element)
                if (lastHtmlComponent) {
                  parts.push(
                    <button
                      key="html"
                      className="text-bolt-elements-textPrimary hover:text-bolt-elements-textHeading transition-colors cursor-pointer"
                      onMouseEnter={() => highlightElement(lastHtmlComponent)}
                      onMouseLeave={clearHighlight}
                      onClick={() => updateTreeToComponent(lastHtmlComponent, originalTree)}
                    >
                      {lastHtml?.displayName || lastHtmlComponent.name || 'element'}
                    </button>,
                  );
                }

                return (
                  <div className="flex items-center gap-1">
                    {parts.map((part, index) => (
                      <React.Fragment key={index}>
                        {part}
                        {index < parts.length - 1 && (
                          <ChevronRight size={12} className="text-bolt-elements-textSecondary flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}
              <button
                onClick={() => workbenchStore.setSelectedElement(null)}
                className="ml-1 p-0.5 hover:bg-bolt-elements-background-depth-3 rounded transition-colors flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            className={classNames(
              'w-full border-none resize-none text-bolt-elements-textPrimary bg-transparent text-base rounded-md',
              'focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none active:border-none',
              { 'opacity-50 cursor-not-allowed': hasPendingMessage },
              'placeholder:text-bolt-elements-textSecondary',
              selectedElement ? 'pt-10 px-3 pb-3' : 'p-3',
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
                      componentNames: selectedElement.tree.map(
                        (comp: ReactComponent) => comp.displayName || 'Anonymous',
                      ),
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
            placeholder={getPlaceholderText(chatStarted, hasAppSummary)}
            translate="no"
          />

          {/* Start Building Button - shown when discovery rating is high enough */}
          {(() => {
            const showStartBuildingButton = user && startPlanningRating > 0 && !hasAppSummary && !hasPendingMessage;

            return showStartBuildingButton ? (
              <ClientOnly>
                {() => <StartBuildingButton onClick={handleStartBuilding} startPlanningRating={startPlanningRating} />}
              </ClientOnly>
            ) : null;
          })()}
        </div>

        {/* Bottom controls */}
        <div className="flex justify-between items-center p-2">
          <div className="flex gap-2 items-center">
            {/* Microphone button */}
            {/* <TooltipProvider>
              <WithTooltip tooltip={isListening ? 'Stop listening' : 'Start speech recognition'}>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-background border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2 p-2 aspect-square"
                  disabled={hasPendingMessage}
                  onClick={isListening ? onStopListening : onStartListening}
                >
                  <Mic size={16} className="text-bolt-elements-textPrimary" />
                </Button>
              </WithTooltip>
            </TooltipProvider> */}

            {/* Plus/Upload button */}
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
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-background border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2 p-2 aspect-square"
                  onClick={handleFileUpload}
                >
                  <Plus size={16} className="text-bolt-elements-textPrimary" />
                </Button>
              </WithTooltip>
            </TooltipProvider>
          </div>

          {/* Send Button */}
          <Button
            onClick={() => {
              if (hasPendingMessage) {
                chatStore.showStopConfirmation.set(true);
                return;
              }
              if (input.length > 0 || uploadedFiles.length > 0) {
                const componentReference = selectedElement?.tree
                  ? {
                      componentNames: selectedElement.tree.map(
                        (comp: ReactComponent) => comp.displayName || 'Anonymous',
                      ),
                    }
                  : undefined;

                handleSendMessage({
                  messageInput: input,
                  chatMode: ChatMode.UserMessage,
                  componentReference,
                });

                if (selectedElement) {
                  workbenchStore.setSelectedElement(null);
                }
              }
            }}
            disabled={hasPendingMessage || !input.length || !uploadedFiles.length}
            className="px-5 py-2.5 rounded-full font-medium bg-bolt-elements-textPrimary text-background hover:bg-bolt-elements-textPrimary/90 transition-all duration-200 flex items-center gap-2"
          >
            <span>Send</span>
            <span className="text-white/70 text-sm">⌘Enter</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

function getPlaceholderText(chatStarted: boolean, hasAppSummary: boolean) {
  if (!chatStarted) {
    // There is no app and no messages have been sent yet.
    return 'What would you like Replay Builder to build? Click here';
  }

  if (!hasAppSummary) {
    // We've started discovery but haven't started building yet.
    return "Is there anything else you'd like me to know?";
  }

  // We have an app that is being iterated on.
  return 'How can we help you?';
}

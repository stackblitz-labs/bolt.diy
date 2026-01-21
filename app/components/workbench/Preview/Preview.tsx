import { memo, useEffect, useRef, useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { designPanelStore } from '~/lib/stores/designSystemStore';
import { elementPickerStore, setIsElementPickerEnabled, setIsElementPickerReady } from '~/lib/stores/elementPicker';
import AppView, { type ResizeSide } from './components/AppView';
import MultiDevicePreview, { type MultiDevicePreviewRef } from './components/InfiniteCanvas/MultiDevicePreview';
import { useVibeAppAuthPopup } from '~/lib/hooks/useVibeAppAuth';
import { Monitor, ExternalLink, Eye, Paintbrush, Shrink, RefreshCcw, Fullscreen } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { Button } from '~/components/ui/button';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '~/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { buildBreadcrumbData } from '~/utils/componentBreadcrumb';
import { useIsMobile } from '~/lib/hooks/useIsMobile';
import { chatStore } from '~/lib/stores/chat';

interface ReactComponent {
  displayName?: string;
  name?: string;
  props?: Record<string, unknown>;
  state?: unknown;
  type: 'class' | 'function' | 'host';
  selector?: string;
}

let gCurrentIFrameRef: React.RefObject<HTMLIFrameElement> | undefined;

export function getCurrentIFrame() {
  return gCurrentIFrameRef?.current ?? undefined;
}

type PreviewMode = 'preview' | 'editor';

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const multiDevicePreviewRef = useRef<MultiDevicePreviewRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMouseOverPreviewRef = useRef(false);
  const { isMobile } = useIsMobile();

  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMode, setActiveMode] = useState<PreviewMode>('preview');

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();

  const previewURL = useStore(workbenchStore.previewURL);
  const previewLoading = useStore(chatStore.previewLoading);
  const isPreviewReady = previewURL && !previewLoading;
  const selectedElement = useStore(workbenchStore.selectedElement);
  const isElementPickerEnabled = useStore(elementPickerStore.isEnabled);
  const isElementPickerReady = useStore(elementPickerStore.isReady);

  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  const SCALING_FACTOR = 2;

  gCurrentIFrameRef = iframeRef;

  const reloadPreview = (route = '') => {
    if (isDeviceModeOn && multiDevicePreviewRef.current) {
      multiDevicePreviewRef.current.reloadAll();
    } else if (iframeRef.current) {
      iframeRef.current.src = iframeUrl + route + '?forceReload=' + Date.now();
    }
    setIsElementPickerReady(false);
    setIsElementPickerEnabled(false);
  };

  // Toggle element picker in iframe
  const toggleElementPicker = (enabled: boolean) => {
    const iframe = getCurrentIFrame();
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'ELEMENT_PICKER_CONTROL',
          enabled,
        },
        '*',
      );
    }
  };

  // Helper functions for element highlighting
  const highlightElement = (component: ReactComponent) => {
    const iframe = getCurrentIFrame();
    if (!iframe || !iframe.contentWindow) {
      return;
    }

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

  // Helper function to update when clicking breadcrumb items
  const updateTreeToComponent = (clickedComponent: ReactComponent, tree: ReactComponent[]) => {
    const clickedIndex = tree.indexOf(clickedComponent);
    if (clickedIndex === -1) {
      return;
    }

    const newTree = tree.slice(clickedIndex);
    const lastReactComponent = [...newTree]
      .reverse()
      .find((comp: ReactComponent) => comp.type === 'function' || comp.type === 'class');

    workbenchStore.setSelectedElement({
      component: lastReactComponent ?? clickedComponent,
      tree: newTree,
    });
  };

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_PICKED') {
        workbenchStore.setSelectedElement({
          component: event.data.react.component,
          tree: event.data.react.tree,
        });
        setIsElementPickerEnabled(false);

        const disableMessage = { type: 'ELEMENT_PICKER_CONTROL', enabled: false };
        if (multiDevicePreviewRef.current) {
          multiDevicePreviewRef.current.postMessageToAll(disableMessage);
        }
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(disableMessage, '*');
        }
      } else if (event.data.type === 'ELEMENT_PICKER_STATUS') {
        // Status update from iframe
      } else if (event.data.type === 'ELEMENT_PICKER_READY' && event.data.source === 'element-picker') {
        setIsElementPickerReady(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!previewURL) {
      setUrl('');
      setIframeUrl(undefined);
      return;
    }

    setUrl(previewURL);
    setIframeUrl(previewURL);
    setIsElementPickerReady(false);
    setIsElementPickerEnabled(false);
  }, [previewURL]);

  // Handle OAuth authentication
  useVibeAppAuthPopup({
    iframeRef,
    iframeUrl,
    setIframeUrl,
    setUrl,
    reloadPreview,
    previewURL,
  });

  const toggleFullscreen = async () => {
    if (!isFullscreen && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleDeviceMode = () => {
    setIsDeviceModeOn((prev) => !prev);
  };

  const startResizing = (e: React.MouseEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) {
      return;
    }

    document.body.style.userSelect = 'none';

    resizingState.current.isResizing = true;
    resizingState.current.side = side;
    resizingState.current.startX = e.clientX;
    resizingState.current.startWidthPercent = widthPercent;
    resizingState.current.windowWidth = window.innerWidth;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingState.current.isResizing) {
      return;
    }

    const dx = e.clientX - resizingState.current.startX;
    const windowWidth = resizingState.current.windowWidth;
    const dxPercent = (dx / windowWidth) * 100 * SCALING_FACTOR;

    let newWidthPercent = resizingState.current.startWidthPercent;

    if (resizingState.current.side === 'right') {
      newWidthPercent = resizingState.current.startWidthPercent + dxPercent;
    } else if (resizingState.current.side === 'left') {
      newWidthPercent = resizingState.current.startWidthPercent - dxPercent;
    }

    newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));
    setWidthPercent(newWidthPercent);
  };

  const onMouseUp = () => {
    resizingState.current.isResizing = false;
    resizingState.current.side = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
  };

  useEffect(() => {
    const handleWindowResize = () => {
      // widthPercent is relative, no action needed
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // Prevent back navigation when over preview
  useEffect(() => {
    window.history.pushState({ preventBack: true }, '');

    let isRestoringState = false;

    const handlePopState = (_event: PopStateEvent) => {
      if (isRestoringState) {
        isRestoringState = false;
        return;
      }

      const themeChanges = designPanelStore.themeChanges.get();
      const hasUnsavedChanges = themeChanges.hasChanges;

      if (isMouseOverPreviewRef.current && hasUnsavedChanges) {
        const confirmed = window.confirm(
          'You have unsaved changes in the design panel. Are you sure you want to navigate away?',
        );
        if (!confirmed) {
          isRestoringState = true;
          window.history.pushState({ preventBack: true }, '');
          return;
        }
      } else if (isMouseOverPreviewRef.current) {
        const confirmed = window.confirm('Are you sure you want to navigate away?');
        if (!confirmed) {
          isRestoringState = true;
          window.history.pushState({ preventBack: true }, '');
          return;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleMouseEnter = () => {
    isMouseOverPreviewRef.current = true;
  };

  const handleMouseLeave = () => {
    isMouseOverPreviewRef.current = false;
  };

  const openInNewTab = () => {
    if (iframeUrl) {
      window.open(iframeUrl, '_blank');
    }
  };

  const handleElementPickerToggle = () => {
    if (!isElementPickerReady) {
      return;
    }
    const newState = !isElementPickerEnabled;
    setIsElementPickerEnabled(newState);
    toggleElementPicker(newState);
  };

  return (
    <TooltipProvider>
      <div ref={containerRef} className="w-full h-full flex flex-col relative bg-bolt-elements-background-depth-1">
        {isPortDropdownOpen && (
          <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
        )}

        {/* Top Navigation Bar */}
        {isPreviewReady && (
          <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor p-2 flex items-center justify-between gap-2">
            {/* Left: Preview/Editor Toggle */}
            {!isMobile && (
              <div className="flex items-center h-9 bg-muted rounded-lg p-1">
                <button
                  onClick={() => {
                    setActiveMode('preview');
                    handleElementPickerToggle();
                  }}
                  className={classNames(
                    'flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium rounded-md transition-all',
                    activeMode === 'preview'
                      ? 'bg-background text-bolt-elements-textPrimary border border-input shadow-sm'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <Eye size={16} />
                  Preview
                </button>
                <button
                  onClick={() => {
                    setActiveMode('editor');
                    handleElementPickerToggle();
                  }}
                  className={classNames(
                    'flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium rounded-md transition-all',
                    activeMode === 'editor'
                      ? 'bg-background text-bolt-elements-textPrimary border border-input shadow-sm'
                      : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                  disabled={!isElementPickerReady || isMobile}
                >
                  <Paintbrush size={16} />
                  Editor
                </button>
              </div>
            )}

            {/* Center: Device Selector + URL */}
            <div className="flex h-9 w-fit items-center justify-center gap-1 border border-border border-solid rounded-full px-1">
              {/* Device Dropdown */}
              <Button
                variant="outline"
                onClick={toggleDeviceMode}
                className="flex items-center gap-1.5 h-7 px-3 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary rounded-full"
              >
                <Monitor size={16} />
                {isDeviceModeOn ? 'Multi-Device' : 'Desktop'}
              </Button>

              {/* URL Input */}
              <div className="flex items-center px-2 w-fit">
                <input
                  title="URL"
                  ref={inputRef}
                  className="w-[200px] bg-transparent text-sm text-bolt-elements-textSecondary border-none outline-none focus:ring-0 p-0 truncate"
                  type="text"
                  value={url}
                  placeholder="https://"
                  onChange={(event) => {
                    setUrl(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      if (url !== iframeUrl) {
                        setIframeUrl(url);
                      } else {
                        reloadPreview();
                      }

                      if (inputRef.current) {
                        inputRef.current.blur();
                      }
                    }
                  }}
                />
              </div>

              <WithTooltip tooltip="Open in new tab">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openInNewTab}
                  className="h-7 w-7 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                >
                  <ExternalLink size={16} />
                </Button>
              </WithTooltip>

              <WithTooltip tooltip="Reload">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => reloadPreview()}
                  className="h-7 w-7 min-w-7 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-border rounded-full p-0"
                >
                  <RefreshCcw size={16} />
                </Button>
              </WithTooltip>
            </div>

            <WithTooltip tooltip="Toggle full screen">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-9 w-9 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                {isFullscreen ? <Shrink size={16} /> : <Fullscreen size={16} />}
              </Button>
            </WithTooltip>
          </div>
        )}

        {/* Preview Area */}
        <div
          className={`flex-1 bg-bolt-elements-background-depth-2 bg-opacity-30 ${isDeviceModeOn ? 'overflow-hidden' : 'flex justify-center items-center overflow-auto'}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {isDeviceModeOn ? (
            <MultiDevicePreview ref={multiDevicePreviewRef} iframeUrl={iframeUrl ?? ''} />
          ) : (
            <AppView
              isDeviceModeOn={isDeviceModeOn}
              iframeRef={iframeRef}
              iframeUrl={iframeUrl ?? ''}
              previewURL={url}
              startResizing={startResizing}
              widthPercent={widthPercent}
            />
          )}
        </div>

        {/* Bottom: Breadcrumb Navigation */}
        {!isMobile && selectedElement && (selectedElement.tree?.length > 0 || selectedElement.component) && (
          <div className="bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor px-4 py-2">
            {(() => {
              if (!selectedElement?.tree || selectedElement.tree.length === 0) {
                return (
                  <Breadcrumb>
                    <BreadcrumbList className="text-sm">
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-bolt-elements-textPrimary font-medium">
                          {selectedElement?.component?.displayName || 'Selection'}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                );
              }

              const originalTree = selectedElement.tree as ReactComponent[];
              const breadcrumb = buildBreadcrumbData(originalTree, {
                getDisplayName: (comp) => comp.displayName || comp.name,
                getKind: (comp) => (comp.type === 'function' || comp.type === 'class' ? 'react' : 'html'),
              });

              if (!breadcrumb) {
                return null;
              }

              const { htmlElements, firstReact, lastReact, lastHtml } = breadcrumb;
              const lastReactComponent = lastReact?.item as ReactComponent | undefined;
              const firstReactComponent = firstReact?.item as ReactComponent | undefined;
              const lastHtmlComponent = lastHtml?.item as ReactComponent | undefined;
              const lastReactDisplayName = lastReact?.displayName;
              const firstReactDisplayName = firstReact?.displayName;

              return (
                <Breadcrumb>
                  <BreadcrumbList className="text-sm">
                    {/* Show last React component (if different from first) */}
                    {lastReactComponent && firstReactComponent && lastReactDisplayName !== firstReactDisplayName && (
                      <BreadcrumbItem>
                        <BreadcrumbPage
                          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary cursor-pointer transition-colors"
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
                    )}

                    {/* Ellipsis dropdown for HTML elements (if more than 1) */}
                    {htmlElements.length > 1 && (
                      <>
                        {lastReactComponent &&
                          firstReactComponent &&
                          lastReactDisplayName !== firstReactDisplayName && (
                            <BreadcrumbSeparator>/</BreadcrumbSeparator>
                          )}
                        <BreadcrumbItem>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
                              <BreadcrumbEllipsis className="h-4 w-4" />
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
                          </DropdownMenu>
                        </BreadcrumbItem>
                      </>
                    )}

                    {/* Show last HTML element */}
                    {lastHtmlComponent && (
                      <>
                        {(htmlElements.length > 1 ||
                          (lastReactComponent &&
                            firstReactComponent &&
                            lastReactDisplayName !== firstReactDisplayName)) && (
                          <BreadcrumbSeparator>/</BreadcrumbSeparator>
                        )}
                        <BreadcrumbItem>
                          <BreadcrumbPage
                            className="text-bolt-elements-textPrimary font-medium hover:text-bolt-elements-textSecondary cursor-pointer transition-colors"
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
        )}
      </div>
    </TooltipProvider>
  );
});

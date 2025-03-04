import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { ScreenshotSelector } from './ScreenshotSelector';

type ResizeSide = 'left' | 'right' | null;

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
  hasFrame?: boolean;
  frameType?: 'mobile' | 'tablet' | 'laptop' | 'desktop';
}

const WINDOW_SIZES: WindowSize[] = [
  { name: 'iPhone SE', width: 375, height: 667, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPhone 12/13', width: 390, height: 844, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  {
    name: 'iPhone 12/13 Pro Max',
    width: 428,
    height: 926,
    icon: 'i-ph:device-mobile',
    hasFrame: true,
    frameType: 'mobile',
  },
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  {
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    icon: 'i-ph:device-tablet',
    hasFrame: true,
    frameType: 'tablet',
  },
  { name: 'Small Laptop', width: 1280, height: 800, icon: 'i-ph:laptop' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'i-ph:laptop' },
  { name: 'Large Laptop', width: 1440, height: 900, icon: 'i-ph:laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'i-ph:monitor' },
  { name: '4K Display', width: 3840, height: 2160, icon: 'i-ph:monitor' },
];

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5);
  const [currentWidth, setCurrentWidth] = useState<number>(0);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  // Reduce scaling factor to make resizing less sensitive
  const SCALING_FACTOR = 1;

  const [isWindowSizeDropdownOpen, setIsWindowSizeDropdownOpen] = useState(false);
  const [selectedWindowSize, setSelectedWindowSize] = useState<WindowSize>(WINDOW_SIZES[0]);

  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);

  useEffect(() => {
    if (!activePreview) {
      setUrl('');
      setIframeUrl(undefined);

      return;
    }

    const { baseUrl } = activePreview;
    setUrl(baseUrl);
    setIframeUrl(baseUrl);
  }, [activePreview]);

  const validateUrl = useCallback(
    (value: string) => {
      if (!activePreview) {
        return false;
      }

      const { baseUrl } = activePreview;

      if (value === baseUrl) {
        return true;
      } else if (value.startsWith(baseUrl)) {
        return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
      }

      return false;
    },
    [activePreview],
  );

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);
      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex]);

  const reloadPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

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

    // Limit width percentage between 10% and 90%
    newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

    setWidthPercent(newWidthPercent);

    // Calculate and update the actual pixel width
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * newWidthPercent) / 100));
    }
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
      // Update the window width in the resizing state
      resizingState.current.windowWidth = window.innerWidth;

      // Update the current width in pixels
      if (containerRef.current && isDeviceModeOn) {
        const containerWidth = containerRef.current.clientWidth;
        setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Initial calculation of current width
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isDeviceModeOn, widthPercent]);

  // Update current width when device mode is toggled
  useEffect(() => {
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }
  }, [isDeviceModeOn]);

  const GripIcon = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: 'var(--bolt-elements-textSecondary, rgba(0,0,0,0.5))',
          fontSize: '10px',
          lineHeight: '5px',
          userSelect: 'none',
          marginLeft: '1px',
        }}
      >
        ••• •••
      </div>
    </div>
  );

  const openInNewWindow = (size: WindowSize) => {
    if (activePreview?.baseUrl) {
      const match = activePreview.baseUrl.match(/^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/);

      if (match) {
        const previewId = match[1];
        const previewUrl = `/webcontainer/preview/${previewId}`;

        // Adjust dimensions for landscape mode if applicable
        let width = size.width;
        let height = size.height;

        if (isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet')) {
          // Swap width and height for landscape mode
          width = size.height;
          height = size.width;
        }

        // Create a more reliable approach by using a wrapper page
        if (showDeviceFrame && size.hasFrame) {
          // Calculate frame dimensions
          const frameWidth = size.frameType === 'mobile' ? 40 : 60; // 20px or 30px on each side
          const frameHeight = size.frameType === 'mobile' ? 80 : 100; // 40px or 50px on top and bottom

          // Create a window with the correct dimensions first
          const newWindow = window.open(
            '',
            '_blank',
            `width=${width + frameWidth},height=${height + frameHeight + 40},menubar=no,toolbar=no,location=no,status=no`,
          );

          if (!newWindow) {
            console.error('Failed to open new window');
            return;
          }

          // Create the HTML content for the frame
          const frameColor = '#111';
          const frameRadius = size.frameType === 'mobile' ? '36px' : '20px';
          const framePadding = size.frameType === 'mobile' ? '40px 20px' : '50px 30px';

          // Position notch and home button based on orientation
          const notchTop = isLandscape ? '50%' : '20px';
          const notchLeft = isLandscape ? '20px' : '50%';
          const notchTransform = isLandscape ? 'translateY(-50%)' : 'translateX(-50%)';
          const notchWidth = isLandscape ? '8px' : size.frameType === 'mobile' ? '60px' : '80px';
          const notchHeight = isLandscape ? (size.frameType === 'mobile' ? '60px' : '80px') : '8px';

          const homeBottom = isLandscape ? '50%' : '15px';
          const homeRight = isLandscape ? '15px' : '50%';
          const homeTransform = isLandscape ? 'translateY(50%)' : 'translateX(50%)';
          const homeWidth = isLandscape ? '4px' : '40px';
          const homeHeight = isLandscape ? '40px' : '4px';

          // Create HTML content for the wrapper page
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>${size.name} Preview</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  background: #f0f0f0;
                  overflow: hidden;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                
                .device-container {
                  position: relative;
                }
                
                .device-name {
                  position: absolute;
                  top: -30px;
                  left: 0;
                  right: 0;
                  text-align: center;
                  font-size: 14px;
                  color: #333;
                }
                
                .device-frame {
                  position: relative;
                  border-radius: ${frameRadius};
                  background: ${frameColor};
                  padding: ${framePadding};
                  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                  overflow: hidden;
                }
                
                /* Notch */
                .device-frame:before {
                  content: '';
                  position: absolute;
                  top: ${notchTop};
                  left: ${notchLeft};
                  transform: ${notchTransform};
                  width: ${notchWidth};
                  height: ${notchHeight};
                  background: #333;
                  border-radius: 4px;
                  z-index: 2;
                }
                
                /* Home button */
                .device-frame:after {
                  content: '';
                  position: absolute;
                  bottom: ${homeBottom};
                  right: ${homeRight};
                  transform: ${homeTransform};
                  width: ${homeWidth};
                  height: ${homeHeight};
                  background: #333;
                  border-radius: 50%;
                  z-index: 2;
                }
                
                iframe {
                  border: none;
                  width: ${width}px;
                  height: ${height}px;
                  background: white;
                  display: block;
                }
                
                .controls {
                  position: absolute;
                  top: -60px;
                  left: 0;
                  right: 0;
                  display: flex;
                  justify-content: center;
                  gap: 10px;
                }
                
                .button {
                  background: #6D28D9;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  padding: 4px 10px;
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.2s;
                }
                
                .button:hover {
                  background: #5b21b6;
                }
              </style>
            </head>
            <body>
              <div class="device-container">
                <div class="controls">
                  <div class="device-name">${size.name} ${isLandscape ? '(Landscape)' : '(Portrait)'}</div>
                </div>
                <div class="device-frame">
                  <iframe src="${previewUrl}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin" allow="cross-origin-isolated"></iframe>
                </div>
              </div>
            </body>
            </html>
          `;

          // Write the HTML content to the new window
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();

          newWindow.focus();
        } else {
          // Standard window without frame
          const newWindow = window.open(
            previewUrl,
            '_blank',
            `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`,
          );

          if (newWindow) {
            newWindow.focus();
          }
        }
      } else {
        console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col relative ${isPreviewOnly ? 'fixed inset-0 z-50 bg-white' : ''}`}
    >
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} />
          <IconButton
            icon="i-ph:selection"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={isSelectionMode ? 'bg-bolt-elements-background-depth-3' : ''}
          />
        </div>

        <div className="flex-grow flex items-center gap-1 bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-3 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive">
          <input
            title="URL"
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && validateUrl(url)) {
                setIframeUrl(url);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {previews.length > 1 && (
            <PortDropdown
              activePreviewIndex={activePreviewIndex}
              setActivePreviewIndex={setActivePreviewIndex}
              isDropdownOpen={isPortDropdownOpen}
              setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
              setIsDropdownOpen={setIsPortDropdownOpen}
              previews={previews}
            />
          )}

          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />

          <IconButton
            icon="i-ph:layout-light"
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            title={isPreviewOnly ? 'Show Full Interface' : 'Show Preview Only'}
          />

          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />

          <div className="flex items-center relative">
            <IconButton
              icon="i-ph:arrow-square-out"
              onClick={() => openInNewWindow(selectedWindowSize)}
              title={`Open Preview in ${selectedWindowSize.name} Window`}
            />
            <IconButton
              icon="i-ph:caret-down"
              onClick={() => setIsWindowSizeDropdownOpen(!isWindowSizeDropdownOpen)}
              className="ml-1"
              title="Select Window Size"
            />

            {isWindowSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsWindowSizeDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] max-h-[400px] overflow-y-auto bg-white dark:bg-black rounded-xl shadow-2xl border border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)] overflow-hidden">
                  <div className="p-3 border-b border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#111827] dark:text-gray-300">Device Options</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280] dark:text-gray-400">Show Device Frame</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                            showDeviceFrame ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'
                          } relative`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeviceFrame(!showDeviceFrame);
                          }}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                              showDeviceFrame ? 'transform translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280] dark:text-gray-400">Landscape Mode</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                            isLandscape ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'
                          } relative`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsLandscape(!isLandscape);
                          }}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                              isLandscape ? 'transform translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  {WINDOW_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className="w-full px-4 py-3.5 text-left text-[#111827] dark:text-gray-300 text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-gray-900 bg-white dark:bg-black"
                      onClick={() => {
                        setSelectedWindowSize(size);
                        setIsWindowSizeDropdownOpen(false);
                        openInNewWindow(size);
                      }}
                    >
                      <div
                        className={`${size.icon} w-5 h-5 text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200`}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {size.name}
                        </span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet')
                            ? `${size.height} × ${size.width}`
                            : `${size.width} × ${size.height}`}
                          {size.hasFrame && showDeviceFrame ? ' (with frame)' : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 border-t border-bolt-elements-borderColor flex justify-center items-center overflow-auto">
        <div
          style={{
            width: isDeviceModeOn ? `${widthPercent}%` : '100%',
            height: '100%',
            overflow: 'visible',
            background: 'var(--bolt-elements-background-depth-1)',
            position: 'relative',
            display: 'flex',
          }}
        >
          {activePreview ? (
            <>
              <iframe
                ref={iframeRef}
                title="preview"
                className="border-none w-full h-full bg-bolt-elements-background-depth-1"
                src={iframeUrl}
                sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                allow="cross-origin-isolated"
              />
              <ScreenshotSelector
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                containerRef={iframeRef}
              />
            </>
          ) : (
            <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
              No preview available
            </div>
          )}

          {isDeviceModeOn && (
            <>
              {/* Width indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,0.7))',
                  color: 'var(--bolt-elements-textPrimary, white)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  pointerEvents: 'none',
                  opacity: resizingState.current.isResizing ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              >
                {currentWidth}px
              </div>

              <div
                onMouseDown={(e) => startResizing(e, 'left')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '15px',
                  marginLeft: '-7px', // Move handle closer to the edge
                  height: '100%',
                  cursor: 'ew-resize',
                  background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                  userSelect: 'none',
                  zIndex: 10,
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))')
                }
                title="Drag to resize width"
              >
                <GripIcon />
              </div>

              <div
                onMouseDown={(e) => startResizing(e, 'right')}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '15px',
                  marginRight: '-7px', // Move handle closer to the edge
                  height: '100%',
                  cursor: 'ew-resize',
                  background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                  userSelect: 'none',
                  zIndex: 10,
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))')
                }
                title="Drag to resize width"
              >
                <GripIcon />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

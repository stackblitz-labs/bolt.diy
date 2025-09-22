import { useStore } from '@nanostores/react';
import { memo, useEffect, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import AppView, { type ResizeSide } from './components/AppView';
import useViewport from '~/lib/hooks';
import { useVibeAppAuthPopup } from '~/lib/hooks/useVibeAppAuth';
import { type DetectedError } from '~/lib/replay/MessageHandlerInterface';
import { getDetectedErrors } from '~/lib/replay/MessageHandler';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { flushSimulationData } from '~/components/chat/ChatComponent/functions/flushSimulationData';

let gCurrentIFrame: HTMLIFrameElement | undefined;

export function getCurrentIFrame() {
  return gCurrentIFrame;
}

interface PreviewProps {
  handleSendMessage: (params: ChatMessageParams) => void;
}

export const Preview = memo(({ handleSendMessage }: PreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionPoint, setSelectionPoint] = useState<{ x: number; y: number } | null>(null);

  const previewURL = useStore(workbenchStore.previewURL);
  const isSmallViewport = useViewport(800);
  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5); // 375px assuming 1000px window width initially

  const [detectedError, setDetectedError] = useState<DetectedError | undefined>(undefined);
  const [fixingError, setFixingError] = useState(false);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  // Define the scaling factor
  const SCALING_FACTOR = 2; // Adjust this value to increase/decrease sensitivity

  gCurrentIFrame = iframeRef.current ?? undefined;

  // Interval for sending getDetectedErrors message
  useEffect(() => {
    let lastDetectedError: DetectedError | undefined = undefined;
    const interval = setInterval(async () => {
      if (!iframeRef.current) {
        return;
      }

      const detectedErrors = await getDetectedErrors(iframeRef.current);
      const firstError: DetectedError | undefined = detectedErrors[0];
      if (JSON.stringify(firstError) !== JSON.stringify(lastDetectedError)) {
        setDetectedError(firstError);
      }
      lastDetectedError = firstError;
    }, 1000);

    return () => clearInterval(interval);
  }, [iframeRef.current]);

  const reloadPreview = (route = '') => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl + route + '?forceReload=' + Date.now();
    }

    setIsSelectionMode(false);
    setSelectionPoint(null);
    setDetectedError(undefined);
    setFixingError(false);
  };

  useEffect(() => {
    if (!previewURL) {
      setUrl('');
      setIframeUrl(undefined);
      setSelectionPoint(null);

      return;
    }

    setUrl(previewURL);
    setIframeUrl(previewURL);
    setDetectedError(undefined);
    setFixingError(false);
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

    // Prevent text selection
    document.body.style.userSelect = 'none';

    resizingState.current.isResizing = true;
    resizingState.current.side = side;
    resizingState.current.startX = e.clientX;
    resizingState.current.startWidthPercent = widthPercent;
    resizingState.current.windowWidth = window.innerWidth;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault(); // Prevent any text selection on mousedown
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingState.current.isResizing) {
      return;
    }

    const dx = e.clientX - resizingState.current.startX;
    const windowWidth = resizingState.current.windowWidth;

    // Apply scaling factor to increase sensitivity
    const dxPercent = (dx / windowWidth) * 100 * SCALING_FACTOR;

    let newWidthPercent = resizingState.current.startWidthPercent;

    if (resizingState.current.side === 'right') {
      newWidthPercent = resizingState.current.startWidthPercent + dxPercent;
    } else if (resizingState.current.side === 'left') {
      newWidthPercent = resizingState.current.startWidthPercent - dxPercent;
    }

    // Clamp the width between 10% and 90%
    newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

    setWidthPercent(newWidthPercent);
  };

  const onMouseUp = () => {
    resizingState.current.isResizing = false;
    resizingState.current.side = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Restore text selection
    document.body.style.userSelect = '';
  };

  // Handle window resize to ensure widthPercent remains valid
  useEffect(() => {
    const handleWindowResize = () => {
      /*
       * Optional: Adjust widthPercent if necessary
       * For now, since widthPercent is relative, no action is needed
       */
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative bg-bolt-elements-background-depth-1">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor/50 p-3 flex items-center gap-2 shadow-sm">
        <IconButton icon="i-ph:arrow-clockwise" onClick={() => reloadPreview()} />
        <div className="flex items-center gap-2 flex-grow bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary rounded-xl px-4 py-2 text-sm hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-borderColor focus-within:bg-bolt-elements-background-depth-3 focus-within:border-blue-500/50 focus-within:text-bolt-elements-textPrimary transition-all duration-200 shadow-sm hover:shadow-md">
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

        {!isSmallViewport && (
          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />
        )}
        {!isSmallViewport && (
          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />
        )}
      </div>

      <div className="flex-1 bg-bolt-elements-background-depth-2/30 flex justify-center items-center overflow-auto">
        <AppView
          isDeviceModeOn={isDeviceModeOn}
          iframeRef={iframeRef}
          iframeUrl={iframeUrl ?? ''}
          isSelectionMode={isSelectionMode}
          previewURL={url}
          selectionPoint={selectionPoint}
          setIsSelectionMode={setIsSelectionMode}
          setSelectionPoint={setSelectionPoint}
          startResizing={startResizing}
          widthPercent={widthPercent}
        />
      </div>

      {/* Error Display Section */}
      {detectedError && !fixingError && (
        <div className="border-t border-bolt-elements-borderColor/50 bg-red-50 dark:bg-red-950/20 p-4">
          <div className="font-semibold text-sm text-red-600 dark:text-red-300 mb-2">
            Error: {detectedError.message}
          </div>
          {detectedError.details && (
            <div className="text-xs text-red-600 dark:text-red-300 mb-3">{detectedError.details}</div>
          )}
          <button
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            onClick={async () => {
              setFixingError(true);

              if (iframeRef.current) {
                const simulationData = await flushSimulationData();
                let message = 'Fix the error I saw while using the app: ' + detectedError.message;
                if (detectedError.details) {
                  message += '\n\n' + detectedError.details;
                }
                handleSendMessage({
                  messageInput: message,
                  chatMode: ChatMode.FixDetectedError,
                  sessionRepositoryId: workbenchStore.repositoryId.get(),
                  simulationData,
                  detectedError,
                });
              }
            }}
          >
            Ask Nut to fix
          </button>
        </div>
      )}

      {/* Nut Working Display */}
      {fixingError && (
        <div className="border-t border-bolt-elements-borderColor/50 bg-blue-50 dark:bg-blue-950/20 p-3">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Nut is working on fixing the error...
          </div>
        </div>
      )}
    </div>
  );
});

import { memo, useEffect, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { designPanelStore } from '~/lib/stores/designSystemStore';
import { setIsElementPickerEnabled, setIsElementPickerReady } from '~/lib/stores/elementPicker';
import AppView, { type ResizeSide } from './components/AppView';
import MultiDevicePreview, { type MultiDevicePreviewRef } from './components/InfiniteCanvas/MultiDevicePreview';
import useViewport from '~/lib/hooks';
import { useVibeAppAuthPopup } from '~/lib/hooks/useVibeAppAuth';
import { RotateCw, MonitorSmartphone, Maximize2, Minimize2 } from '~/components/ui/Icon';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';

let gCurrentIFrameRef: React.RefObject<HTMLIFrameElement> | undefined;

export function getCurrentIFrame() {
  return gCurrentIFrameRef?.current ?? undefined;
}

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const multiDevicePreviewRef = useRef<MultiDevicePreviewRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMouseOverPreviewRef = useRef(false);

  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();

  const previewURL = useStore(workbenchStore.previewURL);

  const isSmallViewport = useViewport(800);
  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5); // 375px assuming 1000px window width initially

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  // Define the scaling factor
  const SCALING_FACTOR = 2; // Adjust this value to increase/decrease sensitivity

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

  // Send postMessage to control element picker in iframe(s)
  const toggleElementPicker = (enabled: boolean) => {
    const message = {
      type: 'ELEMENT_PICKER_CONTROL',
      enabled,
    };

    if (isDeviceModeOn && multiDevicePreviewRef.current) {
      // Send to all iframes in device mode
      multiDevicePreviewRef.current.postMessageToAll(message);
    } else if (iframeRef.current?.contentWindow) {
      // Send to single iframe in responsive mode
      iframeRef.current.contentWindow.postMessage(message, '*');
    } else {
      console.warn('[Preview] Cannot send message - iframe not ready');
    }
  };

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_PICKED') {
        // Store the full element data including the react tree
        workbenchStore.setSelectedElement({
          component: event.data.react.component,
          tree: event.data.react.tree,
        });
        setIsElementPickerEnabled(false);

        // Disable element picker on all iframes after picking
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

  // Prevent back navigation (two-finger swipe) when over preview
  useEffect(() => {
    // Push a state to track navigation
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

  // Track mouse position over preview area
  const handleMouseEnter = () => {
    isMouseOverPreviewRef.current = true;
  };

  const handleMouseLeave = () => {
    isMouseOverPreviewRef.current = false;
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative bg-bolt-elements-background-depth-1">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 p-3 flex items-center gap-2 shadow-sm">
        <IconButton icon={<RotateCw size={20} />} onClick={() => reloadPreview()} />
        <div
          className={classNames(
            'flex items-center gap-2 flex-grow bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textSecondary px-4 py-2 text-sm hover:bg-bolt-elements-background-depth-3 hover:border-bolt-elements-borderColor focus-within:bg-bolt-elements-background-depth-3 focus-within:border-blue-500/50 focus-within:text-bolt-elements-textPrimary transition-all duration-200 shadow-sm hover:shadow-md',
            {
              'rounded-xl': !isSmallViewport,
            },
          )}
        >
          <input
            title="URL"
            ref={inputRef}
            className="w-full bg-transparent border-none outline-none focus:ring-0 focus:ring-offset-0 p-0"
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
            icon={<MonitorSmartphone size={20} />}
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />
        )}
        {!isSmallViewport && (
          <IconButton
            icon={isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />
        )}
      </div>

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
    </div>
  );
});

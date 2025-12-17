import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import InfiniteCanvas from './InfiniteCanvas';
import DeviceFrame, { DEVICE_PRESETS, type DeviceType } from './DeviceFrame';

interface MultiDevicePreviewProps {
  iframeUrl: string;
  onIframeReady?: (deviceType: DeviceType, iframe: HTMLIFrameElement) => void;
  onAllIframesReady?: (iframes: Record<DeviceType, HTMLIFrameElement>) => void;
  className?: string;
}

export interface MultiDevicePreviewRef {
  getIframes: () => Record<DeviceType, HTMLIFrameElement | null>;
  reloadAll: () => void;
  postMessageToAll: (message: unknown) => void;
}

const MultiDevicePreview = forwardRef<MultiDevicePreviewRef, MultiDevicePreviewProps>(
  ({ iframeUrl, onIframeReady, onAllIframesReady, className = '' }, ref) => {
    const iframeRefs = useRef<Record<DeviceType, HTMLIFrameElement | null>>({
      desktop: null,
      tablet: null,
      mobile: null,
    });

    const readyState = useRef<Record<DeviceType, boolean>>({
      desktop: false,
      tablet: false,
      mobile: false,
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getIframes: () => iframeRefs.current,
      reloadAll: () => {
        Object.values(iframeRefs.current).forEach((iframe) => {
          if (iframe && iframeUrl) {
            iframe.src = iframeUrl + '?forceReload=' + Date.now();
          }
        });
      },
      postMessageToAll: (message: unknown) => {
        Object.values(iframeRefs.current).forEach((iframe) => {
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
          }
        });
      },
    }));

    const handleIframeRef = useCallback(
      (deviceType: DeviceType) => (iframe: HTMLIFrameElement | null) => {
        iframeRefs.current[deviceType] = iframe;
      },
      [],
    );

    const handleIframeLoad = useCallback(
      (deviceType: DeviceType) => () => {
        const iframe = iframeRefs.current[deviceType];
        if (iframe) {
          readyState.current[deviceType] = true;
          onIframeReady?.(deviceType, iframe);

          // Check if all iframes are ready
          if (Object.values(readyState.current).every((ready) => ready)) {
            const iframes = iframeRefs.current as Record<DeviceType, HTMLIFrameElement>;
            onAllIframesReady?.(iframes);
          }
        }
      },
      [onIframeReady, onAllIframesReady],
    );

    // Clear element picker highlight when mouse leaves a device frame
    // Clear on ALL iframes to prevent artifacts when moving between devices
    const handleMouseLeave = useCallback((_deviceType: DeviceType) => {
      // Clear highlights on all iframes
      Object.values(iframeRefs.current).forEach((iframe) => {
        if (iframe?.contentWindow) {
          // Send multiple messages to ensure highlight is cleared
          iframe.contentWindow.postMessage({ type: 'ELEMENT_PICKER_HIGHLIGHT', selector: null }, '*');
          iframe.contentWindow.postMessage({ type: 'ELEMENT_PICKER_HIGHLIGHT', selector: '' }, '*');
          iframe.contentWindow.postMessage({ type: 'ELEMENT_PICKER_CLEAR_HOVER' }, '*');
        }
      });
    }, []);

    // Update iframe sources when iframeUrl changes
    useEffect(() => {
      if (iframeUrl) {
        Object.entries(iframeRefs.current).forEach(([deviceType, iframe]) => {
          if (iframe) {
            readyState.current[deviceType as DeviceType] = false;
            iframe.src = iframeUrl + '?forceReload=' + Date.now();
          }
        });
      }
    }, [iframeUrl]);

    // Layout positions for devices (spread out horizontally)
    const devicePositions: Record<DeviceType, { x: number; y: number }> = {
      desktop: { x: 0, y: 0 },
      tablet: { x: DEVICE_PRESETS.desktop.width + 100, y: 0 },
      mobile: { x: DEVICE_PRESETS.desktop.width + DEVICE_PRESETS.tablet.width + 200, y: 0 },
    };

    const devices: DeviceType[] = ['desktop', 'tablet', 'mobile'];

    if (!iframeUrl) {
      return (
        <div className={`w-full h-full flex items-center justify-center ${className}`}>
          <div className="text-bolt-elements-textSecondary">No preview URL available</div>
        </div>
      );
    }

    return (
      <InfiniteCanvas className={`w-full h-full ${className}`} initialZoom={0.4}>
        {devices.map((deviceType) => {
          const device = DEVICE_PRESETS[deviceType];
          const position = devicePositions[deviceType];

          return (
            <DeviceFrame
              key={deviceType}
              device={device}
              x={position.x}
              y={position.y}
              onMouseLeave={() => handleMouseLeave(deviceType)}
            >
              <iframe
                ref={handleIframeRef(deviceType)}
                className="h-full w-full border-0"
                title={`${device.name} preview`}
                src={iframeUrl}
                onLoad={handleIframeLoad(deviceType)}
                allowFullScreen
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-forms allow-modals"
                loading="eager"
                style={{
                  width: device.width,
                  height: device.height,
                }}
              />
            </DeviceFrame>
          );
        })}
      </InfiniteCanvas>
    );
  },
);

MultiDevicePreview.displayName = 'MultiDevicePreview';

export default MultiDevicePreview;

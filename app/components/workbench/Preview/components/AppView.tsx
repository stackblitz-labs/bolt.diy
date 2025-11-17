import GripIcon from '~/components/icons/GripIcon';
import ProgressStatus from './ProgressStatus/ProgressStatus';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState } from 'react';
import { useVibeAppAuthQuery } from '~/lib/hooks/useVibeAppAuth';
import { chatStore } from '~/lib/stores/chat';
import PreviewLoad from './PreviewLoad/PreviewLoad';
import { isFeatureStatusImplemented } from '~/lib/persistence/messageAppSummary';
import { classNames } from '~/utils/classNames';
import useViewport from '~/lib/hooks/useViewport';

export type ResizeSide = 'left' | 'right' | null;

const AppView = ({
  isDeviceModeOn,
  widthPercent,
  previewURL,
  iframeRef,
  iframeUrl,
  startResizing,
}: {
  isDeviceModeOn: boolean;
  widthPercent: number;
  previewURL: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  iframeUrl: string;
  startResizing: (e: React.MouseEvent, side: ResizeSide) => void;
}) => {
  const [iframeForceReload, setIframeForceReload] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const repositoryId = useStore(workbenchStore.repositoryId);
  const appSummary = useStore(chatStore.appSummary);
  const initialBuildComplete = isFeatureStatusImplemented(appSummary?.features?.[0]?.status);
  const isSmallViewport = useViewport(800);
  const previewLoading = useStore(chatStore.previewLoading);
  const handleTokenOrRepoChange = (params: URLSearchParams) => {
    setRedirectUrl(`https://${repositoryId}.http.replay.io/auth/callback#${params.toString()}`);
  };

  useVibeAppAuthQuery({
    iframeForceReload,
    setIframeForceReload,
    repositoryId,
    iframeUrl,
    onTokenOrRepoChange: handleTokenOrRepoChange,
  });

  const actualIframeUrl = redirectUrl || iframeUrl;

  return (
    <div
      style={{
        width: isDeviceModeOn ? `${widthPercent}%` : '100%',
        height: '100%',
        overflow: 'visible',
        position: 'relative',
        display: 'flex',
      }}
      className="bg-bolt-elements-background-depth-1"
    >
      {previewURL && !previewLoading ? (
        <div className={'relative w-full h-full'}>
          <div
            className={classNames('absolute inset-0', {
              'p-[3px] app-progress-border opacity-80': !initialBuildComplete,
              'rounded-b-xl': !isSmallViewport,
            })}
          >
            <iframe
              key={actualIframeUrl}
              ref={iframeRef}
              title="preview"
              className={classNames('w-full h-full bg-white transition-all duration-300 opacity-100', {
                'rounded-b-xl': !isSmallViewport,
              })}
              src={actualIframeUrl}
              allowFullScreen
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-forms allow-modals"
              loading="eager"
            />
          </div>
        </div>
      ) : (
        <div className="w-full h-full">{initialBuildComplete ? <PreviewLoad /> : <ProgressStatus />}</div>
      )}

      {isDeviceModeOn && previewURL && (
        <>
          <div
            onMouseDown={(e) => startResizing(e, 'left')}
            className="absolute top-0 left-0 w-4 -ml-4 h-full cursor-ew-resize bg-bolt-elements-background-depth-2 bg-opacity-50 hover:bg-bolt-elements-background-depth-3 bg-opacity-70 flex items-center justify-center transition-all duration-200 select-none border-r border-bolt-elements-borderColor border-opacity-30 hover:border-bolt-elements-borderColor border-opacity-50 shadow-sm hover:shadow-md group"
            title="Drag to resize width"
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              <GripIcon />
            </div>
          </div>
          <div
            onMouseDown={(e) => startResizing(e, 'right')}
            className="absolute top-0 right-0 w-4 -mr-4 h-full cursor-ew-resize bg-bolt-elements-background-depth-2 bg-opacity-50 hover:bg-bolt-elements-background-depth-3 bg-opacity-70 flex items-center justify-center transition-all duration-200 select-none border-l border-bolt-elements-borderColor border-opacity-30 hover:border-bolt-elements-borderColor border-opacity-50 shadow-sm hover:shadow-md group"
            title="Drag to resize width"
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              <GripIcon />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AppView;

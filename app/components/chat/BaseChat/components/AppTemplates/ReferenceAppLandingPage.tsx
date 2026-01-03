import React, { useState, useEffect, useRef } from 'react';
import type { LandingPageIndexEntry, LandingPageContent } from '~/lib/replay/ReferenceApps';
import { REFERENCE_APP_PLACEHOLDER_PHOTO, getLandingPageContent } from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { assert } from '~/utils/nut';
import { database } from '~/lib/persistence/apps';
import { getRepositoryURL } from '~/lib/replay/DevelopmentServer';
import AppView, { type ResizeSide } from '~/components/workbench/Preview/components/AppView';

interface ReferenceAppLandingPageProps {
  app: LandingPageIndexEntry;
  sendMessage: (params: ChatMessageParams) => void;
  onClose: () => void;
}

export const ReferenceAppLandingPage: React.FC<ReferenceAppLandingPageProps> = ({ app, sendMessage, onClose }) => {
  const [landingPageContent, setLandingPageContent] = useState<LandingPageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appPreviewURL, setAppPreviewURL] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadLandingPageContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const content = await getLandingPageContent(app.referenceAppPath);
        setLandingPageContent(content);
      } catch (err) {
        console.error('Failed to fetch landing page content:', err);
        setError('Failed to load landing page content');
      } finally {
        setIsLoading(false);
      }
    };

    loadLandingPageContent();

    const createLandingPageReferenceApp = async () => {
      const repositoryId = await database.createLandingPageReferenceApp(app.referenceAppPath);
      setAppPreviewURL(getRepositoryURL(repositoryId));
    };
    createLandingPageReferenceApp();
  }, [app.referenceAppPath]);

  const handleCustomize = async () => {
    const appPath = landingPageContent?.referenceAppPath || app.referenceAppPath;
    const appName = landingPageContent?.name || app.name;
    assert(appPath, 'App path is required');

    sendMessage({
      messageInput: `Build me a new app based on '${appName}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: appPath,
    });
  };

  // Use landing page content if available, otherwise fall back to index entry
  const displayData = landingPageContent || app;
  const displayPhoto = app.screenshotURL || REFERENCE_APP_PLACEHOLDER_PHOTO;

  if (isLoading) {
    return (
      <div className="max-w-[1337px] mx-auto mt-8 mb-8 animate-fade-in">
        <div className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg overflow-hidden shadow-lg p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-bolt-elements-borderColor border-t-rose-500 rounded-full animate-spin" />
            <p className="text-bolt-elements-textSecondary">Loading landing page content...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !landingPageContent) {
    return (
      <div className="max-w-[1337px] mx-auto mt-8 mb-8 animate-fade-in">
        <div className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg overflow-hidden shadow-lg p-6">
          <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
            <h2 className="text-3xl font-bold text-bolt-elements-textHeading">{app.name}</h2>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textHeading hover:bg-bolt-elements-backgroundHover rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
          <div className="p-6">
            <p className="text-bolt-elements-textSecondary mb-6">
              {error || 'Failed to load landing page content. Using basic information.'}
            </p>
            <div className="mb-6">
              <p className="text-lg text-bolt-elements-textSecondary leading-relaxed">{app.shortDescription}</p>
            </div>
            {app.bulletPoints && app.bulletPoints.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-4">Features</h3>
                <ul className="space-y-2">
                  {app.bulletPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-rose-500 mt-1">•</span>
                      <span className="text-bolt-elements-textSecondary">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-4 pt-6 border-t border-bolt-elements-borderColor">
              <button
                onClick={handleCustomize}
                className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors"
              >
                Build me a new app based on this
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1337px] mx-auto mt-8 mb-8 animate-fade-in">
      <div className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg overflow-hidden shadow-lg">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
          <h2 className="text-3xl font-bold text-bolt-elements-textHeading">{displayData.name}</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textHeading hover:bg-bolt-elements-backgroundHover rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Screenshot */}
          <div className="mb-6 rounded-lg overflow-hidden">
            <img src={displayPhoto} alt={displayData.name} className="w-full h-auto object-cover" />
          </div>

          {/* Short Description */}
          <div className="mb-6">
            <p className="text-lg text-bolt-elements-textSecondary leading-relaxed">{displayData.shortDescription}</p>
          </div>

          {/* Long Description (from landing page content) */}
          {landingPageContent.longDescription && (
            <div className="mb-6">
              <p className="text-base text-bolt-elements-textSecondary leading-relaxed">
                {landingPageContent.longDescription}
              </p>
            </div>
          )}

          {/* Bullet Points */}
          {displayData.bulletPoints && displayData.bulletPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-4">Key Features</h3>
              <ul className="space-y-2">
                {displayData.bulletPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-rose-500 mt-1">•</span>
                    <span className="text-bolt-elements-textSecondary">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Features (from landing page content) */}
          {landingPageContent.features && landingPageContent.features.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-4">Features</h3>
              <div className="space-y-4">
                {landingPageContent.features.map((feature, index) => (
                  <div key={index} className="border-l-4 border-rose-500 pl-4">
                    <h4 className="text-lg font-medium text-bolt-elements-textHeading mb-2">{feature.name}</h4>
                    <p className="text-bolt-elements-textSecondary">{feature.description}</p>
                    {feature.artifactURLs && feature.artifactURLs.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {feature.artifactURLs.map((url, urlIndex) => {
                          const isVideo =
                            url.toLowerCase().endsWith('.webm') ||
                            url.toLowerCase().endsWith('.mp4') ||
                            url.toLowerCase().endsWith('.mov');

                          return isVideo ? (
                            <div key={urlIndex} className="relative max-w-xs">
                              <video
                                src={url}
                                controls={true}
                                playsInline
                                preload="metadata"
                                className="w-full rounded-lg border border-bolt-elements-borderColor"
                                style={{ display: 'block', height: 'auto' }}
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          ) : (
                            <img
                              key={urlIndex}
                              src={url}
                              alt={feature.name}
                              className="max-w-xs rounded-lg border border-bolt-elements-borderColor"
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {displayData.tags && displayData.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-4">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {displayData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 text-sm font-medium bg-purple-100/50 dark:bg-purple-500/10 text-bolt-elements-textHeading rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stage Badge */}
          <div className="mb-6">
            <span
              className={`inline-block px-4 py-2 text-sm font-medium rounded-full ${
                displayData.stage === 'Release'
                  ? 'bg-green-100/50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : displayData.stage === 'Beta'
                    ? 'bg-blue-100/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'bg-yellow-100/50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {displayData.stage}
            </span>
          </div>

          {/* App Preview */}
          {appPreviewURL && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-4">Live Preview</h3>
              <div
                className="border border-bolt-elements-borderColor rounded-lg overflow-hidden"
                style={{ height: '600px' }}
              >
                <AppView
                  isDeviceModeOn={false}
                  widthPercent={100}
                  previewURL={appPreviewURL}
                  iframeRef={iframeRef}
                  iframeUrl={appPreviewURL}
                  startResizing={(_e: React.MouseEvent, _side: ResizeSide) => {}}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-bolt-elements-borderColor">
            <button
              onClick={handleCustomize}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors"
            >
              Build me a new app based on this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { LandingPageIndexEntry, LandingPageContent } from '~/lib/replay/ReferenceApps';
import {
  // REFERENCE_APP_PLACEHOLDER_PHOTO,
  getLandingPageContent,
} from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { assert } from '~/utils/nut';
import { database } from '~/lib/persistence/apps';
import { getRepositoryURL } from '~/lib/replay/DevelopmentServer';
import AppView, { type ResizeSide } from '~/components/workbench/Preview/components/AppView';
import { X, Sparkles, Check, ExternalLink, Monitor, ZoomIn, Download } from 'lucide-react';
import { downloadRepository } from '~/lib/replay/Deploy';
import { toast } from 'react-toastify';
import { userStore } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';
import { Button } from '~/components/ui/button';

interface ReferenceAppLandingPageProps {
  app: LandingPageIndexEntry;
  sendMessage: (params: ChatMessageParams) => void;
  onClose: () => void;
}

// Stage badge component for consistent styling
const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  const stageStyles = {
    Release: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    Beta: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    Alpha: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  };

  const style = stageStyles[stage as keyof typeof stageStyles] || stageStyles.Alpha;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${style}`}
    >
      {stage}
    </span>
  );
};

// Feature card component
const FeatureCard: React.FC<{
  name: string;
  description: string;
  artifactURLs?: string[];
  onImageClick?: (url: string) => void;
}> = ({ name, description, artifactURLs, onImageClick }) => {
  return (
    <div className="group relative bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1 rounded-xl p-5 border border-bolt-elements-borderColor hover:border-rose-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-bolt-elements-textPrimary mb-1.5 group-hover:text-rose-500 transition-colors">
            {name}
          </h4>
          <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">{description}</p>
        </div>
      </div>

      {artifactURLs && artifactURLs.length > 0 && (
        <div className="mt-4 flex gap-3 flex-wrap">
          {artifactURLs.map((url, urlIndex) => {
            const isVideo =
              url.toLowerCase().endsWith('.webm') ||
              url.toLowerCase().endsWith('.mp4') ||
              url.toLowerCase().endsWith('.mov');

            return isVideo ? (
              <div
                key={urlIndex}
                className="relative rounded-lg overflow-hidden border border-bolt-elements-borderColor shadow-sm"
              >
                <video src={url} controls playsInline preload="metadata" className="max-w-xs h-auto">
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <button
                key={urlIndex}
                type="button"
                onClick={() => onImageClick?.(url)}
                className="relative group/img rounded-lg overflow-hidden border border-bolt-elements-borderColor shadow-sm hover:shadow-lg hover:border-rose-500/50 transition-all cursor-zoom-in"
              >
                <img src={url} alt={`${name} preview ${urlIndex + 1}`} className="max-w-xs h-auto" />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                    <ZoomIn size={16} className="text-slate-700" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Image lightbox component
const ImageLightbox: React.FC<{
  imageUrl: string | null;
  onClose: () => void;
}> = ({ imageUrl, onClose }) => {
  if (!imageUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X size={24} />
      </button>
      <img
        src={imageUrl}
        alt="Expanded preview"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton: React.FC = () => (
  <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
    <div className="p-8">
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-bolt-elements-borderColor border-t-rose-500 animate-spin" />
          <div
            className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-pink-500/30 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
        </div>
        <div className="text-center">
          <p className="text-bolt-elements-textPrimary font-medium mb-1">Loading template...</p>
          <p className="text-sm text-bolt-elements-textSecondary">Preparing your preview</p>
        </div>
      </div>
    </div>
  </div>
);

export const ReferenceAppLandingPage: React.FC<ReferenceAppLandingPageProps> = ({ app, sendMessage, onClose }) => {
  const [landingPageContent, setLandingPageContent] = useState<LandingPageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appPreviewURL, setAppPreviewURL] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const user = useStore(userStore);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setIsPreviewLoading(false);
  }, []);

  useEffect(() => {
    const loadLandingPageContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const content = await getLandingPageContent(app.referenceAppPath);
        setLandingPageContent(content);
      } catch (err) {
        console.error('Failed to fetch landing page content:', err);
        setError('Failed to load template details');
      } finally {
        setIsLoading(false);
      }
    };

    loadLandingPageContent();

    const createLandingPageReferenceApp = async () => {
      setIsPreviewLoading(true);
      const repositoryId = await database.createLandingPageReferenceApp(app.referenceAppPath);
      setRepositoryId(repositoryId);
      setAppPreviewURL(getRepositoryURL(repositoryId));
    };
    createLandingPageReferenceApp();
  }, [app.referenceAppPath]);

  // Attach load listener to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
      return () => {
        iframe.removeEventListener('load', handleIframeLoad);
      };
    }
  }, [handleIframeLoad, appPreviewURL]);

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

  const handleDownloadCode = async () => {
    if (!repositoryId) {
      toast.error('No repository ID found');
      return;
    }

    try {
      const repositoryContents = await downloadRepository(repositoryId);

      const byteCharacters = atob(repositoryContents);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/zip' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repository-${repositoryId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Repository downloaded successfully');
      if (window.analytics) {
        window.analytics.track('Downloaded Code', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }
    } catch (error) {
      console.error('Error downloading repository:', error);
      toast.error('Failed to download repository');
    }
  };

  // Use landing page content if available, otherwise fall back to index entry
  const displayData = landingPageContent || app;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error or fallback state
  if (error || !landingPageContent) {
    return (
      <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent p-6 border-b border-bolt-elements-borderColor">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">{app.name}</h2>
              <p className="text-bolt-elements-textSecondary">{app.shortDescription}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
              {error}. Showing basic information instead.
            </div>
          )}

          {app.bulletPoints && app.bulletPoints.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Features</h3>
              <ul className="space-y-3">
                {app.bulletPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center mt-0.5">
                      <Check size={12} className="text-rose-500" />
                    </div>
                    <span className="text-bolt-elements-textSecondary">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="pt-6 border-t border-bolt-elements-borderColor">
            <button
              onClick={handleCustomize}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 hover:scale-[1.02]"
            >
              <Sparkles size={18} />
              Build with this template
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent p-6 border-b border-bolt-elements-borderColor">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">{displayData.name}</h2>
              <StageBadge stage={displayData.stage} />
            </div>
            <p className="text-bolt-elements-textSecondary text-lg leading-relaxed">{displayData.shortDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tags */}
        {displayData.tags && displayData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {displayData.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 text-xs font-medium bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary rounded-full border border-bolt-elements-borderColor"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Live Preview */}
        {(appPreviewURL || isPreviewLoading) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full" />
                Live Preview
              </h3>
              {appPreviewURL && (
                <a
                  href={appPreviewURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary hover:text-rose-500 transition-colors"
                >
                  <ExternalLink size={14} />
                  Open in new tab
                </a>
              )}
            </div>
            <div className="relative rounded-xl overflow-hidden border border-bolt-elements-borderColor shadow-lg bg-white">
              {/* Preview Loading State */}
              {isPreviewLoading && (
                <div className="absolute inset-0 pt-8 bg-bolt-elements-background-depth-1 flex flex-col items-center justify-center z-[5]">
                  <div className="flex flex-col items-center gap-4">
                    {/* Animated monitor icon */}
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 flex items-center justify-center">
                        <Monitor size={32} className="text-rose-500" />
                      </div>
                      {/* Pulsing ring */}
                      <div
                        className="absolute -inset-2 rounded-3xl border-2 border-rose-500/30 animate-ping"
                        style={{ animationDuration: '1.5s' }}
                      />
                    </div>
                    {/* Loading text */}
                    <div className="text-center">
                      <p className="text-sm font-medium text-bolt-elements-textPrimary mb-1">Loading preview...</p>
                      <p className="text-xs text-bolt-elements-textSecondary">Starting development server</p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-48 h-1.5 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse"
                        style={{
                          width: '60%',
                          animation: 'previewLoadingBar 2s ease-in-out infinite',
                        }}
                      />
                    </div>
                  </div>
                  <style>{`
                      @keyframes previewLoadingBar {
                        0% { width: 10%; }
                        50% { width: 80%; }
                        100% { width: 10%; }
                      }
                    `}</style>
                </div>
              )}

              {/* Actual Preview */}
              <div
                className={`pt-8 transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                style={{ height: '500px' }}
              >
                {appPreviewURL && (
                  <AppView
                    isDeviceModeOn={false}
                    widthPercent={100}
                    previewURL={appPreviewURL}
                    iframeRef={iframeRef}
                    iframeUrl={appPreviewURL}
                    startResizing={(_e: React.MouseEvent, _side: ResizeSide) => {}}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Hero */}
        {/* <div className="relative rounded-xl overflow-hidden border border-bolt-elements-borderColor shadow-lg">
            <img
              src={displayPhoto}
              alt={displayData.name}
              className="w-full h-auto object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div> */}

        {/* Long Description */}
        {landingPageContent.longDescription && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-bolt-elements-textSecondary leading-relaxed text-base">
              {landingPageContent.longDescription}
            </p>
          </div>
        )}

        {/* Key Features - Bullet Points */}
        {displayData.bulletPoints && displayData.bulletPoints.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full" />
              Key Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayData.bulletPoints.map((point, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-bolt-elements-background-depth-2/50 border border-bolt-elements-borderColor/50"
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mt-0.5">
                    <Check size={12} className="text-white" />
                  </div>
                  <span className="text-sm text-bolt-elements-textSecondary">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Features */}
        {landingPageContent.features && landingPageContent.features.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full" />
              What's Included
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {landingPageContent.features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  name={feature.name}
                  description={feature.description}
                  artifactURLs={feature.artifactURLs}
                  onImageClick={setExpandedImageUrl}
                />
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="relative pt-8 border-t border-bolt-elements-borderColor">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-bolt-elements-textPrimary font-medium">Ready to get started?</p>
              <p className="text-sm text-bolt-elements-textSecondary">Customize this template to fit your needs</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownloadCode} variant="outline" className="rounded-full" disabled={!repositoryId}>
                <Download size={18} />
                Download code
              </Button>

              <Button onClick={handleCustomize} variant="default" className="rounded-full">
                <Sparkles size={18} />
                Build with this template
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox imageUrl={expandedImageUrl} onClose={() => setExpandedImageUrl(null)} />
    </div>
  );
};

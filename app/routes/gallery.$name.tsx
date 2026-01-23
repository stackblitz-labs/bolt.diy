import { json, type LoaderFunctionArgs, type MetaFunction } from '~/lib/remix-types';
import { useParams, Link } from '@remix-run/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import type { LandingPageIndexEntry, LandingPageContent } from '~/lib/replay/ReferenceApps';
import { getLandingPageIndex, getLandingPageContent } from '~/lib/replay/ReferenceApps';
import { database } from '~/lib/persistence/apps';
import { getRepositoryURL } from '~/lib/replay/DevelopmentServer';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import AppView, { type ResizeSide } from '~/components/workbench/Preview/components/AppView';
import {
  X,
  Sparkles,
  Check,
  Monitor,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  SquareMousePointer,
  AppWindowMac,
  Download,
  ExternalLink,
} from 'lucide-react';
import { downloadRepository } from '~/lib/replay/Deploy';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/button';
import { assert } from '~/utils/nut';
import { classNames } from '~/utils/classNames';
import { Menu } from '~/components/sidebar/Menu.client';
import { Header } from '~/components/header/Header';
import useViewport from '~/lib/hooks';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/ui/accordion';
import WithTooltip from '~/components/ui/Tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';

export const meta: MetaFunction = () => {
  return [{ title: 'Gallery | Replay Builder' }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const name = params.name ? decodeURIComponent(params.name) : null;
  if (!name) {
    return json({ error: 'App name is required' }, { status: 400 });
  }

  try {
    const apps = await getLandingPageIndex();
    const app = apps.find((a) => a.name === name);

    if (!app) {
      return json({ error: 'App not found' }, { status: 404 });
    }

    return json({ app });
  } catch (error) {
    console.error('Failed to load app:', error);
    return json({ error: 'Failed to load app' }, { status: 500 });
  }
}

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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
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
const LoadingSkeleton: React.FC<{ isSmallViewport?: boolean; isSidebarCollapsed?: boolean }> = ({
  isSmallViewport = false,
  isSidebarCollapsed = false,
}) => (
  <div
    className={classNames(
      'h-full flex items-center justify-center transition-all duration-300',
      !isSmallViewport
        ? isSidebarCollapsed
          ? 'md:pl-[calc(60px+1.5rem)] md:pr-6'
          : 'md:pl-[calc(260px+1.5rem)] md:pr-6'
        : 'px-4 sm:px-6',
    )}
  >
    <div className="w-full max-w-7xl mx-auto">
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
    </div>
  </div>
);

function GalleryPageContent() {
  const params = useParams();
  const appName = params.name ? decodeURIComponent(params.name) : null;
  const [app, setApp] = useState<LandingPageIndexEntry | null>(null);
  const [landingPageContent, setLandingPageContent] = useState<LandingPageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appPreviewURL, setAppPreviewURL] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const user = useStore(userStore);
  const [repositoryId, setRepositoryId] = useState<string | null>(null);
  const isSmallViewport = useViewport(800);
  const isSidebarCollapsed = useStore(sidebarMenuStore.isCollapsed);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setIsPreviewLoading(false);
  }, []);

  // Load app data
  useEffect(() => {
    if (!appName) {
      setError('App name is required');
      setIsLoading(false);
      return;
    }

    const loadApp = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch app from index
        const apps = await getLandingPageIndex();
        const foundApp = apps.find((a) => a.name === appName);

        if (!foundApp) {
          setError('App not found');
          setIsLoading(false);
          return;
        }

        setApp(foundApp);

        // Load landing page content
        try {
          const content = await getLandingPageContent(foundApp.referenceAppPath);
          setLandingPageContent(content);
        } catch (err) {
          console.error('Failed to fetch landing page content:', err);
          // Continue with index data if content fetch fails
        } finally {
          setIsLoading(false);
        }

        // Create preview
        setIsPreviewLoading(true);
        const repoId = await database.createLandingPageReferenceApp(foundApp.referenceAppPath);
        setRepositoryId(repoId);
        setAppPreviewURL(getRepositoryURL(repoId));
      } catch (err) {
        console.error('Failed to load app:', err);
        setError('Failed to load app');
      } finally {
        setIsLoading(false);
      }
    };

    loadApp();
  }, [appName]);

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
    if (!app) {
      return;
    }

    const appPath = landingPageContent?.referenceAppPath || app.referenceAppPath;
    const appName = landingPageContent?.name || app.name;
    assert(appPath, 'App path is required');

    try {
      // Create a new app with the reference app path
      const appId = await database.createApp(appPath);

      // Navigate to the app with a prompt parameter
      const url = new URL(window.location.origin);
      url.pathname = `/app/${appId}`;
      url.searchParams.set('prompt', `Build me a new app based on '${appName}'`);
      window.location.href = url.toString();
    } catch (error) {
      console.error('Failed to create app:', error);
      toast.error('Failed to create app. Please try again.');
    }
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

  // Get page features for carousel (filter features with kind: 'Page')
  const pageFeatures = landingPageContent?.features?.filter((f) => f.kind === 'Page') || [];
  const carouselItems = [
    { type: 'preview' as const, id: 'preview' },
    ...pageFeatures.map((f, idx) => ({ type: 'feature' as const, id: `feature-${idx}`, feature: f })),
  ];

  // Carousel navigation
  const scrollToCarouselItem = useCallback((index: number) => {
    if (!carouselRef.current) {
      return;
    }
    const container = carouselRef.current;
    const slideWidth = container.clientWidth;
    container.scrollTo({ left: index * slideWidth, behavior: 'smooth' });
    setCarouselIndex(index);
  }, []);

  const handleCarouselScroll = useCallback(() => {
    if (!carouselRef.current) {
      return;
    }
    const container = carouselRef.current;
    const slideWidth = container.clientWidth;
    const newIndex = Math.round(container.scrollLeft / slideWidth);
    setCarouselIndex(newIndex);
  }, []);

  const scrollPrev = useCallback(() => {
    if (carouselIndex > 0) {
      scrollToCarouselItem(carouselIndex - 1);
    }
  }, [carouselIndex, scrollToCarouselItem]);

  const scrollNext = useCallback(() => {
    if (carouselIndex < carouselItems.length - 1) {
      scrollToCarouselItem(carouselIndex + 1);
    }
  }, [carouselIndex, carouselItems.length, scrollToCarouselItem]);

  // Scroll selected button into view when carousel index changes (only if out of view)
  useEffect(() => {
    const button = buttonRefs.current.get(carouselIndex);
    if (button) {
      const container = button.parentElement;
      if (container) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Check if button is out of view
        const isOutOfViewLeft = buttonRect.left < containerRect.left;
        const isOutOfViewRight = buttonRect.right > containerRect.right;

        // Only scroll if button is out of view
        if (isOutOfViewLeft || isOutOfViewRight) {
          button.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }
    }
  }, [carouselIndex]);

  if (isLoading || !app) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1">
        <Menu />
        <div className="flex-1 flex flex-col overflow-hidden">
          {isSmallViewport && <Header />}
          <div className="flex-1 overflow-y-auto">
            <LoadingSkeleton isSmallViewport={isSmallViewport} isSidebarCollapsed={isSidebarCollapsed} />
          </div>
        </div>
      </div>
    );
  }

  // Ensure displayData is available
  if (!displayData) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1">
        <Menu />
        <div className="flex-1 flex flex-col overflow-hidden">
          {isSmallViewport && <Header />}
          <div className="flex-1 overflow-y-auto">
            <LoadingSkeleton isSmallViewport={isSmallViewport} isSidebarCollapsed={isSidebarCollapsed} />
          </div>
        </div>
      </div>
    );
  }

  // Error or fallback state
  if (error || !landingPageContent) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1">
        {/* Sidebar - Desktop only */}
        {!isSmallViewport && <Menu />}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Mobile only */}
          {isSmallViewport && <Header />}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            {/* Top bar with breadcrumbs and customize button */}
            <div
              className={classNames(
                'sticky top-0 z-10 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor py-3 sm:py-4 transition-all duration-300',
                !isSmallViewport
                  ? isSidebarCollapsed
                    ? 'md:pl-[calc(60px+1.5rem)] md:pr-6'
                    : 'md:pl-[calc(260px+1.5rem)] md:pr-6'
                  : 'px-4 sm:px-6',
              )}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                {/* Breadcrumbs */}
                <Breadcrumb>
                  <BreadcrumbList className="text-sm">
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          to="/"
                          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                        >
                          Home
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <span className="text-bolt-elements-textSecondary">/</span>
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          to="/"
                          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                        >
                          Gallery
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <span className="text-bolt-elements-textSecondary">/</span>
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-bolt-elements-textPrimary font-medium">
                        {app?.name || 'App'}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleDownloadCode}
                    variant="outline"
                    className="rounded-full"
                    disabled={!repositoryId}
                  >
                    <Download size={18} />
                    Download code
                  </Button>
                  <Button
                    onClick={handleCustomize}
                    variant="default"
                    className="rounded-full bg-bolt-elements-textPrimary text-background hover:bg-bolt-elements-textPrimary/90"
                  >
                    <Sparkles size={18} className="mr-2" />
                    Customize It
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div
              className={classNames(
                'max-w-7xl mx-auto py-6 sm:py-8 transition-all duration-300',
                !isSmallViewport
                  ? isSidebarCollapsed
                    ? 'md:pl-[calc(60px+1.5rem)] md:pr-6'
                    : 'md:pl-[calc(260px+1.5rem)] md:pr-6'
                  : 'px-4 sm:px-6',
              )}
            >
              <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent p-6 border-b border-bolt-elements-borderColor">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">{app.name}</h2>
                      <p className="text-bolt-elements-textSecondary">{app.shortDescription}</p>
                    </div>
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1">
      {/* Sidebar */}
      <Menu />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Mobile only */}
        {isSmallViewport && <Header />}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Top bar with breadcrumbs and customize button */}
          <div
            className={classNames(
              'sticky top-0 z-10 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor py-3 sm:py-4 transition-all duration-300',
              !isSmallViewport
                ? isSidebarCollapsed
                  ? 'md:pl-[calc(60px+1.5rem)] md:pr-6'
                  : 'md:pl-[calc(260px+1.5rem)] md:pr-6'
                : 'px-4 sm:px-6',
            )}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              {/* Breadcrumbs */}
              <Breadcrumb>
                <BreadcrumbList className="text-sm">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        to="/"
                        className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      >
                        Home
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <span className="text-bolt-elements-textSecondary">/</span>
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        to="/"
                        className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      >
                        Gallery
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <span className="text-bolt-elements-textSecondary">/</span>
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-bolt-elements-textPrimary font-medium">
                      {displayData.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownloadCode}
                  variant="outline"
                  className="rounded-full"
                  disabled={!repositoryId}
                >
                  <Download size={18} />
                  {isSmallViewport ? '' : 'Download code'}
                </Button>
                <Button
                  onClick={handleCustomize}
                  variant="default"
                  className="rounded-full bg-bolt-elements-textPrimary text-background hover:bg-bolt-elements-textPrimary/90"
                >
                  <Sparkles size={18} className="mr-2" />
                  Customize It
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div
            className={classNames(
              'max-w-7xl mx-auto sm:py-8 transition-all duration-300',
              !isSmallViewport
                ? isSidebarCollapsed
                  ? 'md:pl-[calc(60px+1.5rem)] md:pr-6'
                  : 'md:pl-[calc(260px+1.5rem)] md:pr-6'
                : 'sm:px-6',
            )}
          >
            <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md overflow-hidden shadow-xl animate-fade-in">
              {/* Content */}
              <div className="space-y-8">
                {/* Carousel - Preview and Page Features */}
                {(appPreviewURL || isPreviewLoading || pageFeatures.length > 0) && (
                  <div>
                    <div className="relative">
                      {/* Carousel Container */}
                      <div
                        ref={carouselRef}
                        onScroll={handleCarouselScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          WebkitOverflowScrolling: 'touch',
                        }}
                      >
                        {/* Live Preview Slide */}
                        {(appPreviewURL || isPreviewLoading) && (
                          <div className="min-w-full snap-center flex-shrink-0">
                            <div className="relative rounded-t-md overflow-hidden border border-bolt-elements-borderColor shadow-lg bg-white">
                              {/* Preview Loading State */}
                              {isPreviewLoading && (
                                <div className="absolute inset-0 pt-8 bg-bolt-elements-background-depth-1 flex flex-col items-center justify-center z-[5]">
                                  <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 flex items-center justify-center">
                                        <Monitor size={32} className="text-rose-500" />
                                      </div>
                                      <div
                                        className="absolute -inset-2 rounded-3xl border-2 border-rose-500/30 animate-ping"
                                        style={{ animationDuration: '1.5s' }}
                                      />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-sm font-medium text-bolt-elements-textPrimary mb-1">
                                        Loading preview...
                                      </p>
                                      <p className="text-xs text-bolt-elements-textSecondary">
                                        Starting development server
                                      </p>
                                    </div>
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
                                className={`transition-opacity duration-300 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                                style={{ height: isSmallViewport ? '300px' : '500px' }}
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
                                {appPreviewURL && (
                                  <TooltipProvider>
                                    <WithTooltip tooltip="Open in new tab">
                                      <a
                                        href={appPreviewURL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full p-2 text-sm text-bolt-elements-textSecondary hover:bg-white/80 transition-colors shadow-xl border border-bolt-elements-borderColor"
                                      >
                                        <ExternalLink size={16} />
                                      </a>
                                    </WithTooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Feature Slides */}
                        {pageFeatures.map((feature, idx) => (
                          <div
                            key={`feature-${idx}`}
                            className="min-w-full flex items-center justify-center snap-center flex-shrink-0 w-full"
                          >
                            <div className="relative flex items-center justify-center rounded-t-md overflow-hidden border border-bolt-elements-borderColor shadow-lg bg-white w-full">
                              {feature.artifactURLs && feature.artifactURLs.length > 0 && (
                                <div
                                  className="relative flex items-center justify-center bg-bolt-elements-background-depth-1 w-full overflow-hidden"
                                  style={{ height: isSmallViewport ? '300px' : '500px' }}
                                >
                                  <img
                                    src={feature.artifactURLs[0]}
                                    alt={feature.name}
                                    className="max-w-full max-h-full w-full h-full object-contain"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    onClick={() => setExpandedImageUrl(feature.artifactURLs![0])}
                                  />
                                  <button
                                    onClick={() => setExpandedImageUrl(feature.artifactURLs![0])}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors shadow-lg z-10"
                                  >
                                    <ZoomIn size={16} className="text-slate-700" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Carousel Navigation Bar */}
                      {carouselItems.length > 1 && (
                        <div className="flex items-center justify-center gap-2 border-t border-bolt-elements-borderColor pt-4 px-2">
                          <button
                            onClick={scrollPrev}
                            disabled={carouselIndex === 0}
                            className={classNames(
                              'w-8 h-8 rounded-full flex items-center justify-center transition-colors aspect-square',
                              carouselIndex === 0
                                ? 'opacity-50 cursor-not-allowed bg-bolt-elements-background-depth-2'
                                : 'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                            )}
                          >
                            <ChevronLeft size={16} className="text-bolt-elements-textSecondary" />
                          </button>
                          <div
                            className="flex items-center gap-2 overflow-x-auto"
                            style={{
                              scrollbarWidth: 'none',
                              msOverflowStyle: 'none',
                            }}
                          >
                            {carouselItems.map((item, idx) => (
                              <button
                                key={idx}
                                ref={(el) => {
                                  if (el) {
                                    buttonRefs.current.set(idx, el);
                                  } else {
                                    buttonRefs.current.delete(idx);
                                  }
                                }}
                                onClick={() => scrollToCarouselItem(idx)}
                                className={classNames(
                                  'flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg transition-all min-w-[150px] truncate border-2',
                                  idx === carouselIndex
                                    ? 'border-black bg-white text-bolt-elements-textPrimary shadow-sm'
                                    : 'border-transparent bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2',
                                )}
                              >
                                {item.type === 'preview' ? (
                                  <>
                                    <SquareMousePointer
                                      size={18}
                                      className={
                                        idx === carouselIndex
                                          ? 'text-bolt-elements-textPrimary'
                                          : 'text-bolt-elements-textSecondary'
                                      }
                                    />
                                    <span className="text-xs font-medium">Live App</span>
                                  </>
                                ) : (
                                  <>
                                    <AppWindowMac
                                      size={18}
                                      className={
                                        idx === carouselIndex
                                          ? 'text-bolt-elements-textPrimary'
                                          : 'text-bolt-elements-textSecondary'
                                      }
                                    />
                                    <span className="text-xs font-medium">{item.feature.name}</span>
                                  </>
                                )}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={scrollNext}
                            disabled={carouselIndex === carouselItems.length - 1}
                            className={classNames(
                              'w-8 h-8 rounded-full flex items-center justify-center transition-colors aspect-square',
                              carouselIndex === carouselItems.length - 1
                                ? 'opacity-50 cursor-not-allowed bg-bolt-elements-background-depth-2'
                                : 'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                            )}
                          >
                            <ChevronRight size={16} className="text-bolt-elements-textSecondary" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="p-6 space-y-8">
                  {/* App Name, Tags, and Description Section */}
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-bolt-elements-textPrimary mb-4">
                      {displayData.name}
                    </h2>

                    {/* Tags */}
                    {displayData.tags && displayData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {displayData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 text-sm font-medium bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary rounded-full border border-bolt-elements-borderColor"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Long Description */}
                    {landingPageContent?.longDescription && (
                      <div className="space-y-4">
                        {landingPageContent.longDescription
                          .split(/\n\n+/)
                          .filter((p) => p.trim())
                          .map((paragraph, index) => (
                            <p key={index} className="text-bolt-elements-textPrimary text-base leading-relaxed">
                              {paragraph.trim()}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Features Section */}
                  {landingPageContent?.features && landingPageContent.features.length > 0 && (
                    <div>
                      <h3 className="text-2xl font-bold text-bolt-elements-textPrimary mb-4">Features</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {landingPageContent.features.map((feature, index) => (
                          <div key={index} className="bg-bolt-elements-background-depth-2 rounded-md p-4">
                            <h4 className="text-base font-bold text-bolt-elements-textPrimary mb-1.5">
                              {feature.name}
                            </h4>
                            <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* About this app Section */}
                  {displayData.bulletPoints && displayData.bulletPoints.length > 0 ? (
                    <div>
                      <h3 className="text-2xl font-bold text-bolt-elements-textPrimary mb-3">About this app</h3>
                      <p className="text-bolt-elements-textPrimary text-base mb-4">
                        {displayData.shortDescription ||
                          'Organize and automate your inventory at the touch of a button.'}
                      </p>
                      <ul className="space-y-2 list-disc list-outside ml-5">
                        {displayData.bulletPoints.map((point, index) => (
                          <li key={index} className="text-bolt-elements-textPrimary text-base pl-1">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Get real-time reporting insights Section */}
                  {'useCases' in displayData &&
                  displayData.useCases &&
                  Array.isArray(displayData.useCases) &&
                  displayData.useCases.length > 0 ? (
                    <div>
                      <h3 className="text-2xl font-bold text-bolt-elements-textPrimary mb-3">
                        Get real-time reporting insights.
                      </h3>
                      <ul className="space-y-2 list-disc list-outside ml-5">
                        {(displayData.useCases as string[]).map((useCase: string, index: number) => (
                          <li key={index} className="text-bolt-elements-textPrimary text-base pl-1">
                            {useCase}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* FAQ Section */}
                  {landingPageContent &&
                  'faq' in landingPageContent &&
                  landingPageContent.faq &&
                  Array.isArray(landingPageContent.faq) &&
                  landingPageContent.faq.length > 0 ? (
                    <div>
                      <h3 className="text-2xl font-bold text-bolt-elements-textPrimary mb-4">FAQ</h3>
                      <Accordion type="single" collapsible className="w-full">
                        {landingPageContent.faq.map((faqItem: { question: string; answer: string }, index: number) => (
                          <AccordionItem
                            key={index}
                            value={`faq-${index}`}
                            className="border-b border-bolt-elements-borderColor"
                          >
                            <AccordionTrigger className="text-left text-bolt-elements-textPrimary hover:no-underline py-4">
                              {faqItem.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-bolt-elements-textSecondary pb-4">
                              {faqItem.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox imageUrl={expandedImageUrl} onClose={() => setExpandedImageUrl(null)} />
    </div>
  );
}

export default function GalleryRoute() {
  return (
    <ClientOnly
      fallback={
        <div className="flex h-screen w-full overflow-hidden bg-bolt-elements-background-depth-1">
          <Menu />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <LoadingSkeleton isSmallViewport={false} isSidebarCollapsed={false} />
            </div>
          </div>
        </div>
      }
    >
      {() => <GalleryPageContent />}
    </ClientOnly>
  );
}

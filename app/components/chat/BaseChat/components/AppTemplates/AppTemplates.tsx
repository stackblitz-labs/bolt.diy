import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from '@remix-run/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CategorySelector, type IntroSectionCategory } from './CategorySelector';
import { ReferenceAppCard } from './ReferenceAppCard';
import { CollectionModal } from './CollectionModal';
import {
  getLandingPageIndex,
  type LandingPageIndexEntry,
  ReferenceAppStage,
  getCollections,
  type CollectionPageIndexEntry,
} from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { classNames } from '~/utils/classNames';
import { sidebarMenuStore } from '~/lib/stores/sidebarMenu';
import { useStore } from '@nanostores/react';

interface AppTemplatesProps {
  sendMessage: (params: ChatMessageParams) => void;
}

const AppTemplates = ({ sendMessage }: AppTemplatesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>('All');
  const [showAlpha, setShowAlpha] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const hasHandledAppPath = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const [referenceApps, setReferenceApps] = useState<LandingPageIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collections, setCollections] = useState<CollectionPageIndexEntry[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const isSidebarOpen = useStore(sidebarMenuStore.isOpen);
  const [selectedCollection, setSelectedCollection] = useState<CollectionPageIndexEntry | null>(null);

  // Fetch reference apps on mount
  useEffect(() => {
    const loadReferenceApps = async () => {
      try {
        setIsLoading(true);
        const apps = await getLandingPageIndex();
        // Transform the API response to match the component's expected format
        setReferenceApps(apps);
      } catch (error) {
        console.error('Failed to fetch reference apps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReferenceApps();
  }, []);

  // Fetch collections on mount
  useEffect(() => {
    const loadCollections = async () => {
      try {
        setIsLoadingCollections(true);
        const collections = await getCollections();
        setCollections(collections);
      } catch (error) {
        console.error('Failed to fetch collections:', error);
      } finally {
        setIsLoadingCollections(false);
      }
    };
    loadCollections();
  }, []);

  // Handle appPath URL parameter - automatically trigger customize action
  useEffect(() => {
    if (hasHandledAppPath.current || referenceApps.length === 0) {
      return;
    }

    const appPathParam = searchParams.get('appPath');
    if (!appPathParam) {
      return;
    }

    // Find the matching app in referenceApps
    const matchingApp = referenceApps.find((app) => app.referenceAppPath === appPathParam);
    if (!matchingApp) {
      return;
    }

    // Mark as handled to prevent multiple triggers
    hasHandledAppPath.current = true;

    // Automatically trigger the customize action
    sendMessage({
      messageInput: `Build me a new app based on '${matchingApp.name}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: matchingApp.referenceAppPath,
    });
  }, [searchParams, sendMessage, referenceApps]);

  // Filter apps by stage first (before calculating categories)
  const stageFilteredApps = useMemo(() => {
    if (showAlpha) {
      return referenceApps;
    }
    return referenceApps.filter((app) => app.stage !== ReferenceAppStage.Alpha);
  }, [referenceApps, showAlpha]);

  const categories = useMemo(() => {
    const sectionCategories: IntroSectionCategory[] = [];
    sectionCategories.push({ name: 'All', count: stageFilteredApps.length });
    for (const { tags } of stageFilteredApps) {
      for (const tag of tags) {
        const existing = sectionCategories.find((c) => c.name === tag);
        if (existing) {
          existing.count++;
        } else {
          sectionCategories.push({ name: tag, count: 1 });
        }
      }
    }
    return sectionCategories;
  }, [stageFilteredApps]);

  const filteredApps = useMemo(() => {
    let apps = stageFilteredApps;

    // Filter by category
    if (!selectedCategory) {
      return [];
    }
    if (selectedCategory !== 'All') {
      apps = apps.filter((app) => app.tags.some((category) => category === selectedCategory));
    }

    // Filter by search term (case-insensitive match on app names)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      apps = apps.filter((app) => app.name.toLowerCase().includes(searchLower));
    }

    return apps;
  }, [selectedCategory, stageFilteredApps, searchTerm]);

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) {
      return;
    }

    // Don't start dragging if clicking on a button, interactive element, or card
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('[data-card-clickable]')) {
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      x: e.pageX - scrollContainerRef.current.offsetLeft,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    };

    // Prevent text selection during drag
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) {
      return;
    }

    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragStartRef.current.x) * 1.5; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = dragStartRef.current.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Navigation functions for mobile arrows
  const scrollPrev = useCallback(() => {
    if (!scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    const slideWidth = container.clientWidth;
    container.scrollBy({ left: -slideWidth, behavior: 'smooth' });
  }, []);

  const scrollNext = useCallback(() => {
    if (!scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    const slideWidth = container.clientWidth;
    container.scrollBy({ left: slideWidth, behavior: 'smooth' });
  }, []);

  return (
    <div
      id="showcase-gallery"
      className={classNames('w-full mx-auto mt-24 mb-4', {
        'md:pl-[260px]': isSidebarOpen,
        'md:pl-[60px]': !isSidebarOpen,
      })}
    >
      <div className="max-w-[1337px] mx-auto flex flex-col mb-12 animate-fade-in animation-delay-100">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          <span className="text-bolt-elements-textHeading">Start with</span>
          <br />
          <span className="text-rose-500 dark:text-rose-400">a fully working app</span>
        </h1>
        <p className="text-lg md:text-xl text-bolt-elements-textSecondary max-w-3xl">
          Ready to use out-of-the-box (but can be aligned to your needs)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-bolt-elements-borderColor border-t-rose-500 rounded-full animate-spin" />
            <p className="text-bolt-elements-textSecondary">Loading apps...</p>
          </div>
        </div>
      ) : (
        <>
          <CategorySelector
            categories={categories}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            showAlpha={showAlpha}
            onShowAlphaChange={setShowAlpha}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {/* Horizontal scrolling card container */}
          {filteredApps.length > 0 && (
            <>
              <div
                ref={scrollContainerRef}
                className={`overflow-x-auto pb-4 px-4 sm:px-6 animate-fade-in animation-delay-400 mb-4 sm:mb-8 snap-x snap-mandatory ${
                  isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  scrollBehavior: isDragging ? 'auto' : 'smooth',
                }}
              >
                <div className="flex gap-4 sm:gap-6" style={{ minWidth: 'min-content' }}>
                  {filteredApps.map((app) => (
                    <div
                      key={app.name}
                      className="w-[calc(100vw-2rem)] sm:w-[520px] lg:w-[656px] flex-shrink-0 snap-start"
                    >
                      <ReferenceAppCard
                        appName={app.name}
                        description={app.shortDescription}
                        bulletPoints={app.bulletPoints}
                        photo={app.screenshotURL}
                        appPath={app.referenceAppPath}
                        sendMessage={sendMessage}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile navigation arrows */}
              <div className="flex items-center justify-between px-6 sm:hidden mb-8">
                <button
                  type="button"
                  onClick={scrollPrev}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-rose-500 active:scale-95 transition-transform hover:bg-gray-50"
                  aria-label="Previous app"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-rose-500 active:scale-95 transition-transform hover:bg-gray-50"
                  aria-label="Next app"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </>
          )}

          {/* Collections Section */}
          {collections.length > 0 && (
            <div className="max-w-[1337px] mx-auto px-4 sm:px-6 animate-fade-in animation-delay-600">
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-bolt-elements-textHeading mb-2">Collections</h2>
                <p className="text-bolt-elements-textSecondary">Apps for different use cases</p>
              </div>

              {isLoadingCollections ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-bolt-elements-borderColor border-t-rose-500 rounded-full animate-spin" />
                    <p className="text-bolt-elements-textSecondary text-sm">Loading collections...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {collections.map((collection) => (
                    <button
                      key={collection.collectionPath}
                      onClick={() => setSelectedCollection(collection)}
                      className="group text-left bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1 rounded-xl p-6 border border-bolt-elements-borderColor hover:border-rose-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5"
                    >
                      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2 group-hover:text-rose-500 transition-colors">
                        {collection.name}
                      </h3>
                      <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                        {collection.shortDescription}
                      </p>
                      <div className="mt-4 flex items-center text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-medium">View collection</span>
                        <svg
                          className="w-4 h-4 ml-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collection Modal */}
          <CollectionModal
            collection={selectedCollection}
            referenceApps={referenceApps}
            onClose={() => setSelectedCollection(null)}
            onAppClick={(app) => {
              setSelectedCollection(null);
              // Navigate directly to gallery page
              const encodedName = encodeURIComponent(app.name);
              window.location.href = `/gallery/${encodedName}`;
            }}
          />
        </>
      )}
    </div>
  );
};

export default AppTemplates;

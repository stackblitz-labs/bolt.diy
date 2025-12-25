import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from '@remix-run/react';
import { CategorySelector, type IntroSectionCategory } from './CategorySelector';
import { ReferenceAppCard } from './ReferenceAppCard';
import { ReferenceAppLandingPage } from './ReferenceAppLandingPage';
import { fetchReferenceApps, type LandingPageIndexEntry, ReferenceAppStage } from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';

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
  const [selectedApp, setSelectedApp] = useState<LandingPageIndexEntry | null>(null);
  const landingPageRef = useRef<HTMLDivElement>(null);

  // Fetch reference apps on mount
  useEffect(() => {
    const loadReferenceApps = async () => {
      try {
        setIsLoading(true);
        const apps = await fetchReferenceApps();
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

  return (
    <div id="showcase-gallery" className="w-full mx-auto mt-24 mb-4">
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
            <div
              ref={scrollContainerRef}
              className={`overflow-x-auto pb-4 px-2 animate-fade-in animation-delay-400 mb-8 ${
                isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{
                scrollbarWidth: 'thin',
                scrollBehavior: isDragging ? 'auto' : 'smooth',
              }}
            >
              <div className="flex gap-6" style={{ minWidth: 'min-content' }}>
                {filteredApps.map((app) => (
                  <ReferenceAppCard
                    key={app.name}
                    appName={app.name}
                    description={app.shortDescription}
                    bulletPoints={app.bulletPoints}
                    photo={app.screenshotURL}
                    onClick={() => {
                      setSelectedApp(app);
                      // Scroll to landing page after state update
                      setTimeout(() => {
                        landingPageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reference App Landing Page */}
          {selectedApp && (
            <div ref={landingPageRef}>
              <ReferenceAppLandingPage
                app={selectedApp}
                sendMessage={sendMessage}
                onClose={() => setSelectedApp(null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AppTemplates;

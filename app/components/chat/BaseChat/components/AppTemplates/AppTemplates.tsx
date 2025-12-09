import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from '@remix-run/react';
import { CategorySelector, type IntroSectionCategory } from './CategorySelector';
import { ReferenceAppCard } from './ReferenceAppCard';
import { referenceApps } from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';

interface AppTemplatesProps {
  sendMessage: (params: ChatMessageParams) => void;
}

const AppTemplates = ({ sendMessage }: AppTemplatesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>('All');
  const [searchParams] = useSearchParams();
  const hasHandledAppPath = useRef(false);

  // Handle appPath URL parameter - automatically trigger customize action
  useEffect(() => {
    if (hasHandledAppPath.current) {
      return;
    }

    const appPathParam = searchParams.get('appPath');
    if (!appPathParam) {
      return;
    }

    // Find the matching app in referenceApps
    const matchingApp = referenceApps.find((app) => app.appPath === appPathParam);
    if (!matchingApp || !matchingApp.appPath) {
      return;
    }

    // Mark as handled to prevent multiple triggers
    hasHandledAppPath.current = true;

    // Automatically trigger the customize action
    sendMessage({
      messageInput: `Build me a new app based on '${matchingApp.appName}'`,
      chatMode: ChatMode.UserMessage,
      referenceAppPath: matchingApp.appPath,
    });
  }, [searchParams, sendMessage]);

  const categories = useMemo(() => {
    const sectionCategories: IntroSectionCategory[] = [];
    sectionCategories.push({ name: 'All', count: referenceApps.length });
    for (const { categories } of referenceApps) {
      for (const category of categories) {
        const existing = sectionCategories.find((c) => c.name === category);
        if (existing) {
          existing.count++;
        } else {
          sectionCategories.push({ name: category, count: 1 });
        }
      }
    }
    return sectionCategories;
  }, []);

  const filteredApps = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    if (selectedCategory === 'All') {
      return referenceApps;
    }
    return referenceApps.filter((app) => app.categories.some((category) => category === selectedCategory));
  }, [selectedCategory]);

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

      <CategorySelector
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      {/* Horizontal scrolling card container */}
      {filteredApps.length > 0 && (
        <div className="overflow-x-auto pb-4 px-2 animate-fade-in animation-delay-400 mb-8">
          <div className="flex gap-6" style={{ minWidth: 'min-content' }}>
            {filteredApps.map((app) => (
              <ReferenceAppCard
                key={app.appName}
                appName={app.appName}
                description={app.description}
                bulletPoints={app.bulletPoints}
                photo={app.photo}
                appPath={app.appPath}
                sendMessage={sendMessage}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppTemplates;

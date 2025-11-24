import { useState, useMemo } from 'react';
import { CategorySelector, type IntroSectionCategory } from './CategorySelector';
import { ReferenceAppCard } from './ReferenceAppCard';
import { referenceApps } from '~/lib/replay/ReferenceApps';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';

interface AppTemplatesProps {
  sendMessage: (params: ChatMessageParams) => void;
}

const AppTemplates = ({ sendMessage }: AppTemplatesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>('All');

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
    <div id="showcase-gallery" className="w-full mx-auto px-6 lg:px-8 mt-8 mb-4">
      <div className="flex flex-col mb-12 animate-fade-in animation-delay-100">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          <span className="text-bolt-elements-textHeading">Not sure</span>
          <br />
          <span className="text-green-500 dark:text-green-400"> where to start?</span>
        </h1>
        <p className="text-lg md:text-xl text-bolt-elements-textSecondary max-w-3xl">
          Customize one of our reference apps to exactly what you need.
        </p>
      </div>

      <CategorySelector
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      <div className="max-w-4xl mx-auto">
        {filteredApps.length > 0 && (
          <div className="space-y-14 animate-fade-in animation-delay-400 mb-8">
            {filteredApps.map((app, index) => (
              <ReferenceAppCard
                key={app.appName}
                appName={app.appName}
                description={app.description}
                bulletPoints={app.bulletPoints}
                photo={app.photo}
                appPath={app.appPath}
                photoOnLeft={index % 2 === 0}
                sendMessage={sendMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppTemplates;

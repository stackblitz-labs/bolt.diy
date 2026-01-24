import React from 'react';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/button';

export interface IntroSectionCategory {
  name: string;
  count: number;
}

interface CategorySelectorProps {
  categories: IntroSectionCategory[];
  selectedCategory?: string;
  onCategorySelect?: (categoryName: string | undefined) => void;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  showAll,
  onShowAllChange,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="mb-8 animate-fade-in animation-delay-300">
      <div className="flex flex-wrap justify-center items-center gap-3 mb-4">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.name;
          return (
            <Button
              key={category.name}
              onClick={() => onCategorySelect?.(isSelected ? undefined : category.name)}
              className={classNames('px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200', {})}
              variant={isSelected ? 'default' : 'outline'}
            >
              <span>{category.name}</span>
              <span className="ml-1">({category.count})</span>
            </Button>
          );
        })}
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-bolt-elements-textHeading cursor-pointer transition-all duration-200 border border-bolt-elements-borderColor">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => onShowAllChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 focus:ring-1 cursor-pointer"
          />
          <span>Show All</span>
        </label>
      </div>
      <div className="flex justify-center">
        <input
          type="text"
          placeholder="Search apps by name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg text-sm text-bolt-elements-textHeading bg-bolt-elements-background border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-bolt-elements-textSecondary"
        />
      </div>
    </div>
  );
};

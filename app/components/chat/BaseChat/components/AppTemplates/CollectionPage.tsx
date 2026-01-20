import React, { useState, useEffect } from 'react';
import type {
  CollectionPageIndexEntry,
  CollectionPageContent,
  LandingPageIndexEntry,
} from '~/lib/replay/ReferenceApps';
import { getCollectionPageContent } from '~/lib/replay/ReferenceApps';
import { X } from 'lucide-react';

interface CollectionPageProps {
  collection: CollectionPageIndexEntry;
  referenceApps: LandingPageIndexEntry[];
  onClose: () => void;
  onAppClick: (app: LandingPageIndexEntry) => void;
}

const LoadingSkeleton: React.FC = () => (
  <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-bolt-elements-background-depth-2 rounded w-3/4"></div>
        <div className="h-4 bg-bolt-elements-background-depth-2 rounded w-full"></div>
        <div className="h-4 bg-bolt-elements-background-depth-2 rounded w-5/6"></div>
        <div className="mt-8 space-y-3">
          <div className="h-24 bg-bolt-elements-background-depth-2 rounded"></div>
          <div className="h-24 bg-bolt-elements-background-depth-2 rounded"></div>
          <div className="h-24 bg-bolt-elements-background-depth-2 rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

export const CollectionPage: React.FC<CollectionPageProps> = ({ collection, referenceApps, onClose, onAppClick }) => {
  const [collectionContent, setCollectionContent] = useState<CollectionPageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCollectionContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const content = await getCollectionPageContent(collection.collectionPath);
        setCollectionContent(content);
      } catch (err) {
        console.error('Failed to fetch collection content:', err);
        setError('Failed to load collection details');
      } finally {
        setIsLoading(false);
      }
    };

    loadCollectionContent();
  }, [collection.collectionPath]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const displayData = collectionContent || collection;

  return (
    <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl overflow-hidden shadow-xl animate-fade-in">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent p-6 border-b border-bolt-elements-borderColor">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">{displayData.name}</h2>
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
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
            {error}. Showing basic information instead.
          </div>
        )}

        {/* Long Description */}
        {collectionContent?.longDescription && (
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-3">About this collection</h3>
            <p className="text-bolt-elements-textSecondary leading-relaxed whitespace-pre-line">
              {collectionContent.longDescription}
            </p>
          </div>
        )}

        {/* Apps in Collection */}
        {collectionContent?.apps && collectionContent.apps.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
              Apps in this collection ({collectionContent.apps.length})
            </h3>
            <div className="space-y-4">
              {collectionContent.apps.map((collectionApp, index) => {
                // Find the matching reference app from the full list
                const matchingApp = referenceApps.find(
                  (app) => app.referenceAppPath === collectionApp.referenceAppPath,
                );

                if (!matchingApp) {
                  return null;
                }

                return (
                  <button
                    key={index}
                    onClick={() => onAppClick(matchingApp)}
                    className="w-full text-left group bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1 rounded-xl p-5 border border-bolt-elements-borderColor hover:border-rose-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5"
                  >
                    <div className="flex items-start gap-4">
                      {matchingApp.screenshotURL && (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-bolt-elements-borderColor">
                          <img
                            src={matchingApp.screenshotURL}
                            alt={matchingApp.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-bolt-elements-textPrimary mb-1.5 group-hover:text-rose-500 transition-colors">
                          {matchingApp.name}
                        </h4>
                        <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                          {collectionApp.description || matchingApp.shortDescription}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-bolt-elements-textSecondary group-hover:text-rose-500 transition-colors">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(!collectionContent?.apps || collectionContent.apps.length === 0) && (
          <div className="text-center py-12 text-bolt-elements-textSecondary">
            <p>No apps found in this collection.</p>
          </div>
        )}
      </div>
    </div>
  );
};

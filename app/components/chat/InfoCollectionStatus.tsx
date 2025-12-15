/**
 * Info Collection Status Component
 * Shows progress indicator during information collection flow
 */

import { useStore } from '@nanostores/react';
import { collectionProgress, isLoadingSession } from '~/lib/stores/infoCollection';
import type { CollectionStep } from '~/types/info-collection';

const STEP_LABELS: Record<CollectionStep, string> = {
  website_url: 'Website (Optional)',
  google_maps_url: 'Google Maps (Optional)',
  description: 'Description (Required)',
  review: 'Review',
  completed: 'Complete',
};

const STEP_ORDER: CollectionStep[] = ['website_url', 'google_maps_url', 'description', 'review', 'completed'];

export function InfoCollectionStatus() {
  const progress = useStore(collectionProgress);
  const isLoading = useStore(isLoadingSession);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-bolt-elements-background-depth-2 rounded-lg">
        <div className="i-svg-spinners:ring-resize text-bolt-elements-item-contentAccent" />
        <span className="text-sm text-bolt-elements-textSecondary">Loading...</span>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(progress.step);

  return (
    <div className="px-4 py-3 bg-bolt-elements-background-depth-2 rounded-lg">
      <div className="text-xs text-bolt-elements-textSecondary mb-1 font-medium">Website Information Collection</div>
      <div className="text-xs text-bolt-elements-textTertiary mb-2 italic">
        URLs are optional - description is all you need!
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {STEP_ORDER.slice(0, -1).map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step} className="flex items-center">
              {/* Step indicator */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  transition-colors duration-200
                  ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-bolt-elements-item-contentAccent text-white'
                        : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary'
                  }
                `}
              >
                {isCompleted ? <span className="i-ph:check-bold" /> : index + 1}
              </div>

              {/* Connector line */}
              {index < STEP_ORDER.length - 2 && (
                <div
                  className={`
                    w-8 h-0.5 mx-1
                    ${index < currentIndex ? 'bg-green-500' : 'bg-bolt-elements-background-depth-3'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step label */}
      <div className="mt-2 text-sm text-bolt-elements-textPrimary">{STEP_LABELS[progress.step]}</div>

      {/* Collected data preview */}
      {(progress.websiteUrl || progress.googleMapsUrl || progress.description) && (
        <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
          <div className="text-xs text-bolt-elements-textTertiary space-y-1">
            {progress.websiteUrl && (
              <div className="flex items-center gap-2">
                <span className="i-ph:globe text-green-500" />
                <span className="truncate">{progress.websiteUrl}</span>
              </div>
            )}
            {progress.googleMapsUrl && (
              <div className="flex items-center gap-2">
                <span className="i-ph:map-pin text-green-500" />
                <span className="truncate">Google Maps linked</span>
              </div>
            )}
            {progress.description && (
              <div className="flex items-center gap-2">
                <span className="i-ph:text-aa text-green-500" />
                <span className="truncate">Description added</span>
              </div>
            )}
          </div>

          {/* Correction hint */}
          {progress.step === 'review' && (
            <div className="mt-2 pt-2 border-t border-bolt-elements-borderColor">
              <div className="text-xs text-bolt-elements-textTertiary italic">
                💡 Need to change something? Just ask to update any field or start over!
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface Feature {
  /**
   * Unique identifier for the feature.
   */
  id: string;

  /**
   * Short title of the feature to display in the UI.
   */
  name: string;

  /**
   * Description of what the feature does.
   */
  description: string;

  /**
   * Whether the user has already viewed/acknowledged this feature.
   */
  viewed: boolean;

  /**
   * ISO date string for when the feature was released.
   */
  releaseDate: string;
}

const VIEWED_FEATURES_KEY = 'bolt_viewed_features';

// Import client-side localStorage helpers
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';

interface FeatureFromFile {
  id: string;
  name: string;
  description: string;
  releaseDate: string;
}

/**
 * Fetch the list of available features from the bundled features.json file
 * and mark each one as viewed or not based on localStorage state.
 */
export const getFeatureFlags = async (): Promise<Feature[]> => {
  try {
    const response = await fetch('/features.json', { cache: 'no-cache' });

    if (!response.ok) {
      throw new Error(`Failed to fetch features.json: ${response.status}`);
    }

    const data = (await response.json()) as FeatureFromFile[];
    const viewedIds: string[] = getLocalStorage(VIEWED_FEATURES_KEY) || [];

    return data.map((feature) => ({
      ...feature,
      viewed: viewedIds.includes(feature.id),
    }));
  } catch (error) {
    console.error('Error loading feature flags:', error);
    return [];
  }
};

/**
 * Persist that a feature has been viewed by the user.
 * The viewed state is stored locally in the browser via localStorage.
 */
export const markFeatureViewed = async (featureId: string): Promise<void> => {
  try {
    const viewedIds: string[] = getLocalStorage(VIEWED_FEATURES_KEY) || [];

    if (!viewedIds.includes(featureId)) {
      viewedIds.push(featureId);
      setLocalStorage(VIEWED_FEATURES_KEY, viewedIds);
    }
  } catch (error) {
    console.error(`Failed to mark feature ${featureId} as viewed:`, error);
  }
};

export interface Feature {
  id: string;
  name: string;
  description: string;
  viewed: boolean;
  releaseDate: string;
}

export const getFeatureFlags = async (): Promise<Feature[]> => {
  // Do not show stale mock notices while there is no real feature feed.
  return [];
};

export const markFeatureViewed = async (_featureId: string): Promise<void> => Promise.resolve();

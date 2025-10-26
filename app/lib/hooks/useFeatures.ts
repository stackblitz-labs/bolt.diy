import { useState, useEffect } from 'react';
import { getFeatureFlags, markFeatureViewed, type Feature } from '~/lib/api/features';

const VIEWED_FEATURES_KEY = 'bolt_viewed_features';

const getViewedFeatures = (): string[] => {
  try {
    const stored = localStorage.getItem(VIEWED_FEATURES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setViewedFeatures = (featureIds: string[]) => {
  try {
    localStorage.setItem(VIEWED_FEATURES_KEY, JSON.stringify(featureIds));
  } catch (error) {
    console.error('Failed to persist viewed features:', error);
  }
};

export const useFeatures = () => {
  const [hasNewFeatures, setHasNewFeatures] = useState(false);
  const [unviewedFeatures, setUnviewedFeatures] = useState<Feature[]>([]);
  const [viewedFeatureIds, setViewedFeatureIds] = useState<string[]>(() => getViewedFeatures());

  useEffect(() => {
    const checkNewFeatures = async () => {
      try {
        const features = await getFeatureFlags();
        const unviewed = features.filter((feature) => !viewedFeatureIds.includes(feature.id));
        setUnviewedFeatures(unviewed);
        setHasNewFeatures(unviewed.length > 0);
      } catch (error) {
        console.error('Failed to check for new features:', error);
      }
    };

    checkNewFeatures();
  }, [viewedFeatureIds]);

  const acknowledgeFeature = async (featureId: string) => {
    try {
      await markFeatureViewed(featureId);

      const newViewedIds = [...viewedFeatureIds, featureId];
      setViewedFeatureIds(newViewedIds);
      setViewedFeatures(newViewedIds);
      setUnviewedFeatures((prev) => prev.filter((feature) => feature.id !== featureId));
      setHasNewFeatures(unviewedFeatures.length > 1);
    } catch (error) {
      console.error('Failed to acknowledge feature:', error);
    }
  };

  const acknowledgeAllFeatures = async () => {
    try {
      await Promise.all(unviewedFeatures.map((feature) => markFeatureViewed(feature.id)));

      const newViewedIds = [...viewedFeatureIds, ...unviewedFeatures.map((f) => f.id)];
      setViewedFeatureIds(newViewedIds);
      setViewedFeatures(newViewedIds);
      setUnviewedFeatures([]);
      setHasNewFeatures(false);
    } catch (error) {
      console.error('Failed to acknowledge all features:', error);
    }
  };

  return { hasNewFeatures, unviewedFeatures, acknowledgeFeature, acknowledgeAllFeatures };
};

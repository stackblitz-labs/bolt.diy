/**
 * Client-side store for info collection state
 */

import { atom, map } from 'nanostores';
import type { InfoCollectionSession, CollectionStep } from '~/types/info-collection';

// Current active session
export const activeSession = atom<InfoCollectionSession | null>(null);

// Loading states
export const isLoadingSession = atom<boolean>(false);

// Collection progress for UI
export const collectionProgress = map<{
  step: CollectionStep;
  completedSteps: CollectionStep[];
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  description: string | null;
}>({
  step: 'website_url',
  completedSteps: [],
  websiteUrl: null,
  googleMapsUrl: null,
  description: null,
});

// Actions
export function setActiveSession(session: InfoCollectionSession | null) {
  activeSession.set(session);

  if (session) {
    collectionProgress.set({
      step: session.currentStep,
      completedSteps: getCompletedSteps(session.currentStep),
      websiteUrl: session.websiteUrl,
      googleMapsUrl: session.googleMapsUrl,
      description: session.websiteDescription,
    });
  }
}

export function clearSession() {
  activeSession.set(null);
  collectionProgress.set({
    step: 'website_url',
    completedSteps: [],
    websiteUrl: null,
    googleMapsUrl: null,
    description: null,
  });
}

// Helper to determine completed steps
function getCompletedSteps(currentStep: CollectionStep): CollectionStep[] {
  const stepOrder: CollectionStep[] = ['website_url', 'google_maps_url', 'description', 'review', 'completed'];

  const currentIndex = stepOrder.indexOf(currentStep);

  return stepOrder.slice(0, currentIndex);
}

// Fetch session from API
export async function fetchActiveSession(): Promise<void> {
  isLoadingSession.set(true);

  try {
    const response = await fetch('/api/info-collection/active');

    if (response.ok) {
      const data = (await response.json()) as { session?: InfoCollectionSession | null };
      setActiveSession(data.session || null);
    } else {
      setActiveSession(null);
    }
  } catch (error) {
    console.error('Failed to fetch active session:', error);
    setActiveSession(null);
  } finally {
    isLoadingSession.set(false);
  }
}

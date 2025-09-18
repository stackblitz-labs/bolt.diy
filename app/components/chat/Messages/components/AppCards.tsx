import React from 'react';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { openAppCardModal, type AppCardModalType } from '~/lib/stores/appCardModal';
import { FeaturesCard } from './FeaturesCard';
import { MockupCard } from './MockupCard';
import { SecretsCard } from './SecretsCard';
import { AuthSelectorCard } from './AuthSelectorCard';
import { type AppFeature, AppFeatureStatus, type AppSummary } from '~/lib/persistence/messageAppSummary';

// Helper function to check if a status indicates completion
const isStatusComplete = (status: AppFeatureStatus): boolean => {
  return (
    status === AppFeatureStatus.Implemented ||
    status === AppFeatureStatus.ValidationInProgress ||
    status === AppFeatureStatus.Validated ||
    status === AppFeatureStatus.ValidationFailed
  );
};

// Helper function to determine which cards should be shown based on progressive disclosure
const getVisibleCardTypes = (appSummary: AppSummary): string[] => {
  const visibleCards: string[] = [];

  // 1. Mockup Card - show if mockupStatus exists (any status)
  if (appSummary.features?.[0]?.status) {
    visibleCards.push('mockup');
  }

  // 2. Features Card - show when mockup is complete OR when features are ready AND (features exist OR description exists)
  const hasFeatureContent = appSummary.description && appSummary.features && appSummary.features.length > 0;

  // Show features card when mockup is complete OR when features are actually ready to be implemented
  const mockupComplete = isStatusComplete(appSummary.features?.[0]?.status || AppFeatureStatus.NotStarted);

  const featuresReadyToStart = appSummary.features
    ?.slice(1)
    .some((f) => f.status === AppFeatureStatus.ImplementationInProgress || isStatusComplete(f.status));

  if (hasFeatureContent && (mockupComplete || featuresReadyToStart)) {
    visibleCards.push('features');
  }

  // 3. Authentication Card - show when features card is visible AND templateVersion exists
  if (appSummary.templateVersion && visibleCards.includes('features')) {
    visibleCards.push('auth');
  }

  // 4. Secrets Card - show when features card is visible AND there are secrets
  const hasSecrets = appSummary.features?.some((f) => f.secrets?.length);
  if (hasSecrets && visibleCards.includes('features')) {
    visibleCards.push('secrets');
  }

  return visibleCards;
};

export const AppCards: React.FC = () => {
  const appSummary = useStore(chatStore.appSummary);

  if (!appSummary) {
    return null;
  }

  const openModal = (type: AppCardModalType, feature?: AppFeature) => {
    openAppCardModal(type, appSummary, feature);
  };

  const visibleCardTypes = getVisibleCardTypes(appSummary);
  const cards = [];

  // Render cards in progressive order based on visibility
  if (visibleCardTypes.includes('mockup')) {
    cards.push(
      <MockupCard
        key="mockup"
        mockupStatus={appSummary.features?.[0]?.status || AppFeatureStatus.NotStarted}
        appSummary={appSummary}
        onViewDetails={() => openModal('mockup')}
      />,
    );
  }

  if (visibleCardTypes.includes('features')) {
    cards.push(<FeaturesCard key="features" appSummary={appSummary} onViewDetails={() => openModal('features')} />);
  }

  if (visibleCardTypes.includes('auth')) {
    cards.push(<AuthSelectorCard key="auth" appSummary={appSummary} />);
  }

  if (visibleCardTypes.includes('secrets')) {
    cards.push(<SecretsCard key="secrets" appSummary={appSummary} onViewDetails={() => openModal('secrets')} />);
  }

  if (cards.length === 0) {
    return null;
  }

  return <div className="space-y-5 px-3">{cards}</div>;
};

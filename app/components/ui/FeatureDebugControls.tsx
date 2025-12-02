import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { isAdmin } from '~/lib/utils';
import { getChatIdsForFeature } from '~/components/workbench/Preview/components/PlanView/components/Features/components/Events';
import type { ChatResponse } from '~/lib/persistence/response';

interface FeatureDebugControlsProps {
  featureName: string | undefined;
}

function makeFeatureDebugUrl(eventResponses: ChatResponse[], featureName: string | undefined): string {
  const chatIds = getChatIdsForFeature(eventResponses, featureName);
  if (!chatIds.length) {
    return '';
  }

  const filters = chatIds.map((chatId) => ({
    column: 'telemetry.data.nut.chat_id',
    op: 'contains',
    value: chatId,
  }));

  const query = {
    time_range: 28 * 24 * 60 * 60,
    granularity: 0,
    breakdowns: ['telemetry.category'],
    calculations: [
      { op: 'COUNT' },
      { op: 'AVG', column: 'telemetry.data.success' },
      { op: 'AVG', column: 'telemetry.data.fatal' },
    ],
    filters,
    filter_combination: 'OR',
    orders: [{ op: 'COUNT', order: 'descending' }],
    havings: [] as any[],
    limit: 100,
  };

  const encodedQuery = encodeURIComponent(JSON.stringify(query));
  return `https://ui.honeycomb.io/replay/datasets/backend?query=${encodedQuery}`;
}

const FeatureDebugControls = ({ featureName }: FeatureDebugControlsProps) => {
  const user = useStore(userStore);
  const eventResponses = useStore(chatStore.events);

  const chatIds = getChatIdsForFeature(eventResponses, featureName);
  const url = makeFeatureDebugUrl(eventResponses, featureName);

  if (!isAdmin(user) || !url) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const chatIdsString = chatIds.join(' ');
    console.log(`Feature chatIds for ${featureName}: ${chatIds.join(' ')}`);
    await navigator.clipboard.writeText(chatIdsString);
    window.open(url, '_blank');
  };

  return (
    <button onClick={handleClick} className="text-lg hover:scale-110 transition-transform" title="Show backend events">
      🐛
    </button>
  );
};

export default FeatureDebugControls;

import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { isAdmin } from '~/lib/utils';
import { getChatIdsForFeature } from '~/components/workbench/Preview/components/PlanView/components/Features/components/Events';
import type { ChatResponse } from '~/lib/persistence/response';
import { Bug } from '~/components/ui/Icon';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Button } from '~/components/ui/button';

interface FeatureDebugControlsProps {
  featureName: string | undefined;
}

function makeHoneycombUrl(filters: Record<string, string>[], timeRangeSeconds: number): string {
  if (!filters.length) {
    return '';
  }

  const honeycombFilters = filters.map((filter) => {
    const [column, value] = Object.entries(filter)[0];
    return { column, op: '=', value };
  });

  const query = {
    time_range: timeRangeSeconds,
    granularity: 0,
    breakdowns: ['telemetry.category', 'telemetry.data.nut.job_kind', 'telemetry.data.error.errorBucket_start'],
    calculations: [
      { op: 'COUNT' },
      { op: 'AVG', column: 'telemetry.data.success' },
      { op: 'AVG', column: 'telemetry.data.fatal' },
    ],
    filters: honeycombFilters,
    filter_combination: 'OR',
    orders: [{ op: 'COUNT', order: 'descending' }],
    havings: [] as unknown[],
    limit: 100,
  };

  const encodedQuery = encodeURIComponent(JSON.stringify(query));
  return `https://ui.honeycomb.io/replay/datasets/backend?query=${encodedQuery}`;
}

function computeTimeRangeForResponses(eventResponses: ChatResponse[], chatIds: string[]): number {
  const matchingResponses = eventResponses.filter((r) => r.chatId && chatIds.includes(r.chatId));
  if (!matchingResponses.length) {
    return 24 * 60 * 60;
  }

  const times = matchingResponses.map((r) => new Date(r.time).getTime());
  const minTime = Math.min(...times);
  const msFromNow = Date.now() - minTime;
  const daysFromNow = Math.ceil(msFromNow / (24 * 60 * 60 * 1000)) + 1;
  return daysFromNow * 24 * 60 * 60;
}

function makeFeatureDebugUrl(eventResponses: ChatResponse[], featureName: string | undefined): string {
  const chatIds = getChatIdsForFeature(eventResponses, featureName);
  if (!chatIds.length) {
    return '';
  }

  const filters = chatIds.map((chatId) => ({ 'telemetry.data.nut.chat_id': chatId }));
  const timeRangeSeconds = computeTimeRangeForResponses(eventResponses, chatIds);
  return makeHoneycombUrl(filters, timeRangeSeconds);
}

export const DebugAppButton = () => {
  const user = useStore(userStore);
  const appId = useStore(chatStore.currentAppId);

  if (!isAdmin(user) || !appId) {
    return null;
  }

  const url = makeHoneycombUrl([{ app: appId }], 24 * 60 * 60);

  const handleClick = () => {
    window.open(url, '_blank');
  };

  return (
    <TooltipProvider>
      <WithTooltip tooltip="Open app in Honeycomb">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="h-9 w-9 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
        >
          <Bug size={16} />
        </Button>
      </WithTooltip>
    </TooltipProvider>
  );
};

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

    const debugResultString = `Feature chatIds for "${featureName}": ${chatIds.join(' ')}\nURL: ${url}`;
    console.log(debugResultString);
    await navigator.clipboard.writeText(debugResultString);
  };

  return (
    <TooltipProvider>
      <WithTooltip tooltip="Grab backend debug info">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="h-9 w-9 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3"
          title="Grab backend debug info"
        >
          <Bug size={16} />
        </Button>
      </WithTooltip>
    </TooltipProvider>
  );
};

export default FeatureDebugControls;

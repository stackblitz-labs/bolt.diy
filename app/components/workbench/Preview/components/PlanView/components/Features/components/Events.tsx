import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { isWorkerFinishedResponse, type ChatResponse } from '~/lib/persistence/response';
import { chatStore } from '~/lib/stores/chat';
import WithTooltip from '~/components/ui/Tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';

// If a worker doesn't have any updates more recent than this, it is timed out.
const WORK_TIMEOUT_MS = 20 * 60 * 1000;

interface EventsProps {
  featureName: string | undefined;
}

function responseStartsFeature(response: ChatResponse, featureName: string | undefined): boolean {
  if (response.kind !== 'app-event') {
    return false;
  }
  if (featureName) {
    return response.event.name === 'start-feature' && response.event.featureName === featureName;
  }
  return response.event.name === 'start-mockup';
}

function isWorkTimedOut(events: ChatResponse[]) {
  if (events.length === 0) {
    return { isTimedOut: false, minutesSinceLastActivity: 0 };
  }

  const lastEvent = events[events.length - 1];
  return Date.now() - new Date(lastEvent.time).getTime() >= WORK_TIMEOUT_MS;
}

// Return separate streams of events for each worker which has operated on the feature.
function groupWorkerEvents(eventResponses: ChatResponse[], featureName: string | undefined): ChatResponse[][] {
  const chatIds: Set<string> = new Set();
  for (const response of eventResponses) {
    if (response.chatId && responseStartsFeature(response, featureName)) {
      chatIds.add(response.chatId);
    }
  }
  return Array.from(chatIds).map((chatId) => eventResponses.filter((response) => response.chatId === chatId));
}

const Events = ({ featureName }: EventsProps) => {
  const eventResponses = useStore(chatStore.events);
  const workerEvents = groupWorkerEvents(eventResponses, featureName);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<number>>(new Set());

  const toggleWorkerExpansion = (workerIndex: number) => {
    const newExpanded = new Set(expandedWorkers);
    if (newExpanded.has(workerIndex)) {
      newExpanded.delete(workerIndex);
    } else {
      newExpanded.add(workerIndex);
    }
    setExpandedWorkers(newExpanded);
  };

  const renderTime = (time: string) => {
    const date = new Date(time);
    const base = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    if (base.endsWith('AM') || base.endsWith('PM')) {
      return base.slice(0, -2).trim();
    }
    return base;
  };

  const renderEventContents = (response: ChatResponse) => {
    switch (response.kind) {
      case 'done':
        return 'Finished';
      case 'error':
        return 'Had an error and failed';
      case 'aborted':
        return 'Development was aborted';
      default:
        break;
    }
    if (response.kind !== 'app-event') {
      return 'unknown';
    }
    const { event } = response;
    switch (event.name) {
      case 'start-feature':
        return event.why === 'implement' ? 'Writing the feature' : 'Writing tests';
      case 'start-mockup':
        return 'Building the mockup';
      case 'write-mockup-tests':
        return 'Writing tests for mockup';
      case 'run-tests':
        return 'Running tests';
      case 'test-failure':
        if (event.title && event.recordingId) {
          return (
            <div>
              A test failed:
              <a
                href={`https://app.replay.io/recording/${event.recordingId}`}
                className="pl-1 text-blue-500"
                target="_blank"
                rel="noopener noreferrer"
              >
                {event.title}
              </a>
            </div>
          );
        }
        return 'A test failed';
      case 'analyze-test-failure':
        return 'Analyzing the test failure';
      case 'fix-test-failure':
        return 'Fixing the test failure';
      case 'merge-changes':
        return 'Merging changes from another worker';
      case 'resolve-merge-conflict':
        return 'Resolving merge conflict';
      case 'land-changes': {
        const { oldRepositoryId, newRepositoryId } = event;
        return (
          <div>
            Landing changes
            <a
              href={`/view-diff?old=${oldRepositoryId}&new=${newRepositoryId}`}
              className="pl-1 text-blue-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              View diff
            </a>
          </div>
        );
      }
    }
  };

  const renderEvent = (event: ChatResponse, index: number) => {
    const time = renderTime(event.time);
    return (
      <div key={index} className="flex items-center gap-3 pl-4 pb-2">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm" />
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary rounded-lg border border-bolt-elements-borderColor/30">
          {time}
        </span>
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary rounded-lg border border-bolt-elements-borderColor shadow-sm">
          {renderEventContents(event)}
        </span>
      </div>
    );
  };

  const renderWorkerEvents = (events: ChatResponse[], index: number) => {
    let peanuts = 0;
    for (const event of events) {
      if (event.kind === 'app-event' && event.peanuts && event.peanuts > peanuts) {
        peanuts = event.peanuts;
      }
    }

    let tooltip;
    if (featureName) {
      const finished = events.some(isWorkerFinishedResponse);
      if (finished) {
        const landChanges = events.some((event) => event.kind === 'app-event' && event.event.name === 'land-changes');
        if (landChanges) {
          tooltip = 'Work completed';
        } else {
          tooltip = 'No charge, work not completed';
          peanuts = 0;
        }
      } else {
        if (isWorkTimedOut(events)) {
          tooltip = `No charge, worker timed out`;
          peanuts = 0;
        } else {
          tooltip = 'Work in progress';
        }
      }
    } else {
      tooltip = 'No charge for mockup';
      peanuts = 0;
    }

    const isExpanded = expandedWorkers.has(index);
    const shouldShowExpander = events.length > 3;
    const visibleEvents = shouldShowExpander && !isExpanded ? events.slice(0, 3) : events;

    return (
      <div key={index} className="border-t border-bolt-elements-borderColor/50 mb-2">
        <div className="p-4 pt-3 text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2 bg-bolt-elements-background-depth-2/30 px-2 py-1 rounded-md inline-block ml-2">
          <TooltipProvider>
            <WithTooltip tooltip={tooltip}>
              <span>
                Worker {index + 1} ({peanuts} peanuts)
              </span>
            </WithTooltip>
          </TooltipProvider>
        </div>

        <div className="relative">
          {visibleEvents.map(renderEvent)}

          {shouldShowExpander && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => toggleWorkerExpansion(index)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor/50 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                <span>{isExpanded ? `Hide ${events.length - 3} events` : `Show ${events.length - 3} more events`}</span>
                <div
                  className={`i-ph:caret-${isExpanded ? 'up' : 'down'}-bold text-sm transition-transform duration-200`}
                ></div>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return workerEvents.map(renderWorkerEvents);
};

export default Events;

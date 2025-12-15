/**
 * Info Collection Gate Hook
 * Determines whether to run info collection before template selection
 */

import type { InfoCollectionSession } from '~/types/info-collection';

/*
 * ============================================================================
 * Intent Detection
 * ============================================================================
 */

// Keywords that trigger info collection requirement
const WEBSITE_GEN_KEYWORDS = [
  'generate website',
  'create website',
  'build website',
  'new website',
  'make a website',
  'want a website',
  'need a website',
  'generate a website',
  'create a website',
  'build a website',
  'make website',
  'website for my',
  'website for our',
];

/**
 * Check if the user message indicates a website generation intent
 */
export function isWebsiteGenerationIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return WEBSITE_GEN_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}

/*
 * ============================================================================
 * Session Status Check
 * ============================================================================
 */

interface InfoCollectionGateResult {
  /* Whether info collection is needed before proceeding */
  shouldCollectInfo: boolean;

  /* Completed session with data if available */
  completedSession: InfoCollectionSession | null;

  /* Active in-progress session if any */
  activeSession: InfoCollectionSession | null;
}

/**
 * Check info collection session status to determine next action
 * Returns whether we should run info collection or proceed to template selection
 *
 * @param isNewChat - If true, skip checking for completed sessions from previous chats.
 *                    New chats should always start fresh info collection.
 */
export async function checkInfoCollectionStatus(isNewChat: boolean = true): Promise<InfoCollectionGateResult> {
  try {
    /*
     * For NEW chats, don't check for completed sessions from previous chats.
     * Each new chat should start its own info collection flow.
     * We only check for active in-progress sessions to allow resuming abandoned flows.
     */
    if (!isNewChat) {
      // Only check completed sessions for existing chats (not new ones)
      const completedResponse = await fetch('/api/info-collection?status=completed');

      if (completedResponse.ok) {
        const completedData = (await completedResponse.json()) as { session?: InfoCollectionSession };

        if (completedData.session) {
          // Has completed session - can proceed to template selection
          return {
            shouldCollectInfo: false,
            completedSession: completedData.session,
            activeSession: null,
          };
        }
      }
    }

    // Check for active in-progress session (applicable for both new and existing chats)
    const activeResponse = await fetch('/api/info-collection?active=true');

    if (activeResponse.ok) {
      const activeData = (await activeResponse.json()) as { session?: InfoCollectionSession };

      if (activeData.session) {
        // Has active session - continue info collection
        return {
          shouldCollectInfo: true,
          completedSession: null,
          activeSession: activeData.session,
        };
      }
    }

    // No sessions - need to start info collection
    return {
      shouldCollectInfo: true,
      completedSession: null,
      activeSession: null,
    };
  } catch (error) {
    console.error('Failed to check info collection status:', error);

    // On error, default to requiring info collection to be safe
    return {
      shouldCollectInfo: true,
      completedSession: null,
      activeSession: null,
    };
  }
}

/**
 * Combined check: is this a website gen intent AND needs info collection?
 *
 * @param message - User message to check for website generation intent
 * @param isNewChat - If true, this is a new chat that should start fresh info collection
 */
export async function shouldRunInfoCollection(
  message: string,
  isNewChat: boolean = true,
): Promise<{
  isWebsiteGen: boolean;
  gateResult: InfoCollectionGateResult;
}> {
  const isWebsiteGen = isWebsiteGenerationIntent(message);

  if (!isWebsiteGen) {
    return {
      isWebsiteGen: false,
      gateResult: {
        shouldCollectInfo: false,
        completedSession: null,
        activeSession: null,
      },
    };
  }

  const gateResult = await checkInfoCollectionStatus(isNewChat);

  return {
    isWebsiteGen: true,
    gateResult,
  };
}

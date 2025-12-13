/**
 * Info Collection Tools for AI SDK
 * LLM-callable tools for collecting website generation information
 */

import { tool } from 'ai';
import { z } from 'zod';
import { infoCollectionService } from '~/lib/services/infoCollectionService';
import { generateWebsite } from '~/lib/services/websiteGenerationService';
import { validateWebsiteUrl, validateGoogleMapsUrl } from '~/utils/urlValidation';
import { createScopedLogger } from '~/utils/logger';
import type { ProviderInfo } from '~/types/model';
import type { GenerationResult } from '~/types/info-collection';

const logger = createScopedLogger('InfoCollectionTools');

/*
 * ============================================================================
 * Temporary Storage for Generation Results
 * ============================================================================
 * Used to pass chatInjection from tool to onStepFinish without storing
 * the massive template content in message history (which causes token explosion).
 */
const pendingGenerationResults = new Map<string, GenerationResult>();

/**
 * Store a generation result for later retrieval by onStepFinish
 */
export function storePendingGenerationResult(sessionId: string, result: GenerationResult): void {
  pendingGenerationResults.set(sessionId, result);
  logger.debug('Stored pending generation result', { sessionId });
}

/**
 * Retrieve and remove a pending generation result
 */
export function retrievePendingGenerationResult(sessionId: string): GenerationResult | undefined {
  const result = pendingGenerationResults.get(sessionId);

  if (result) {
    pendingGenerationResults.delete(sessionId);
    logger.debug('Retrieved and cleared pending generation result', { sessionId });
  }

  return result;
}

/*
 * ============================================================================
 * Tool Context Type (passed from API route)
 * ============================================================================
 */

export interface ToolContext {
  userId: string;
  sessionId?: string;
  chatId?: string;

  /** LLM model name for template selection */
  model?: string;

  /** LLM provider for template selection */
  provider?: ProviderInfo;

  /** Base URL for API calls (from request) */
  baseUrl?: string;
}

/*
 * ============================================================================
 * Tool Factory
 * ============================================================================
 */

export function createInfoCollectionTools(context: ToolContext) {
  return {
    /**
     * Start or get the info collection session
     */
    startInfoCollection: tool({
      description:
        'Start a new website information collection session or resume an existing one. Call this when user wants to generate/create a website.',
      parameters: z.object({}),
      execute: async () => {
        logger.debug('startInfoCollection called', { userId: context.userId });

        // Check for existing active session
        let session = await infoCollectionService.getActiveSession(context.userId);

        if (!session) {
          // Create new session
          session = await infoCollectionService.createSession(context.userId, context.chatId);
        }

        return {
          sessionId: session.id,
          currentStep: session.currentStep,
          existingData: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
          message:
            session.currentStep === 'website_url'
              ? 'Started new session. Ask user about their existing website.'
              : `Resumed session at step: ${session.currentStep}`,
        };
      },
    }),

    /**
     * Collect website URL from user
     */
    collectWebsiteUrl: tool({
      description:
        'Record whether user has an existing website and collect the URL if they do. Call after asking about existing website.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID from startInfoCollection'),
        hasWebsite: z.boolean().describe('Whether the user has an existing website'),
        url: z.string().optional().describe('The website URL if user has one'),
      }),
      execute: async ({ sessionId, hasWebsite, url }) => {
        logger.debug('collectWebsiteUrl called', { sessionId, hasWebsite, url });

        if (!hasWebsite) {
          // User has no website, skip to next step
          const session = await infoCollectionService.updateWebsiteUrl(sessionId, null, false);
          return {
            success: true,
            message: 'No existing website noted. Proceed to ask about Google Maps listing.',
            nextStep: session.currentStep,
          };
        }

        if (!url) {
          return {
            success: false,
            message: 'User indicated they have a website but no URL provided. Ask for the URL.',
            requiresUrl: true,
          };
        }

        // Validate URL format
        const validation = validateWebsiteUrl(url);

        if (!validation.isValid) {
          return {
            success: false,
            message: `Invalid URL: ${validation.error}. Ask user to provide a valid website URL.`,
            error: validation.error,
          };
        }

        const session = await infoCollectionService.updateWebsiteUrl(sessionId, validation.normalizedUrl, true);

        return {
          success: true,
          normalizedUrl: validation.normalizedUrl,
          message: 'Website URL recorded. Proceed to ask about Google Maps listing.',
          nextStep: session.currentStep,
        };
      },
    }),

    /**
     * Collect Google Maps URL from user
     */
    collectGoogleMapsUrl: tool({
      description: 'Record whether user has a Google Maps business listing and collect the URL if they do.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID'),
        hasListing: z.boolean().describe('Whether user has a Google Maps business listing'),
        url: z.string().optional().describe('The Google Maps URL if user has one'),
      }),
      execute: async ({ sessionId, hasListing, url }) => {
        logger.debug('collectGoogleMapsUrl called', { sessionId, hasListing, url });

        if (!hasListing) {
          const session = await infoCollectionService.updateGoogleMapsUrl(sessionId, null, false);
          return {
            success: true,
            message: 'No Google Maps listing noted. Proceed to ask for website description.',
            nextStep: session.currentStep,
          };
        }

        if (!url) {
          return {
            success: false,
            message: 'User has a listing but no URL provided. Ask for the Google Maps link.',
            requiresUrl: true,
          };
        }

        const validation = validateGoogleMapsUrl(url);

        if (!validation.isValid) {
          return {
            success: false,
            message: `Invalid Google Maps URL: ${validation.error}. Ask user to provide a valid Google Maps link.`,
            error: validation.error,
          };
        }

        const session = await infoCollectionService.updateGoogleMapsUrl(sessionId, validation.normalizedUrl, true);

        return {
          success: true,
          normalizedUrl: validation.normalizedUrl,
          message: 'Google Maps URL recorded. Proceed to ask for website description.',
          nextStep: session.currentStep,
        };
      },
    }),

    /**
     * Collect website description
     */
    collectDescription: tool({
      description: 'Record the user description of their desired website. Any non-empty description is accepted.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID'),
        description: z.string().min(1).describe('User description of desired website'),
      }),
      execute: async ({ sessionId, description }) => {
        logger.debug('collectDescription called', {
          sessionId,
          descLength: description.length,
        });

        const session = await infoCollectionService.updateDescription(sessionId, description.trim());

        return {
          success: true,
          message: 'Description recorded. Present summary to user for confirmation.',
          nextStep: session.currentStep,
          collectedData: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),

    /**
     * Update a specific field (for corrections)
     */
    updateCollectedInfo: tool({
      description: 'Update a previously collected field when user wants to make a correction.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID'),
        field: z.enum(['websiteUrl', 'googleMapsUrl', 'websiteDescription']),
        newValue: z.string().describe('The corrected value'),
      }),
      execute: async ({ sessionId, field, newValue }) => {
        logger.debug('updateCollectedInfo called', { sessionId, field });

        // Validate if URL field
        if (field === 'websiteUrl') {
          const validation = validateWebsiteUrl(newValue);

          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }

          newValue = validation.normalizedUrl!;
        } else if (field === 'googleMapsUrl') {
          const validation = validateGoogleMapsUrl(newValue);

          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }

          newValue = validation.normalizedUrl!;
        }

        const session = await infoCollectionService.updateField(sessionId, field, newValue);

        return {
          success: true,
          message: `${field} updated successfully.`,
          updatedSession: {
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),

    /**
     * Finalize the collection and trigger website generation
     */
    finalizeCollection: tool({
      description:
        'Complete the information collection after user confirms all data is correct. This triggers the website generation pipeline immediately.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID'),
        confirmed: z.boolean().describe('Whether user confirmed the collected information'),
      }),
      execute: async ({ sessionId, confirmed }) => {
        logger.debug('finalizeCollection called', { sessionId, confirmed });

        if (!confirmed) {
          return {
            success: false,
            message: 'User did not confirm. Ask what they would like to change.',
            action: 'await_correction',
          };
        }

        const { session, crawlerPackage } = await infoCollectionService.completeSession(sessionId);

        logger.info('Collection finalized, starting website generation', {
          sessionId,
          hasWebsite: !!session.websiteUrl,
          hasGoogleMaps: !!session.googleMapsUrl,
        });

        // Check if we have the required context for generation
        if (!context.model || !context.provider || !context.baseUrl) {
          logger.warn('Missing context for website generation, returning without generation');

          return {
            success: true,
            message:
              'Information collected successfully! Your data has been saved. Website generation requires additional configuration.',
            sessionId: session.id,
            status: session.status,
            crawlerPackage,
            generationSkipped: true,
          };
        }

        // Run the website generation pipeline
        try {
          const generationResult = await generateWebsite(
            {
              crawlerPackage,
              model: context.model,
              provider: context.provider,
            },
            context.baseUrl,
          );

          if (!generationResult.success) {
            logger.error('Website generation failed', { error: generationResult.error });

            return {
              success: true,
              message: `Information collected! However, website generation encountered an issue: ${generationResult.error}. Please try again.`,
              sessionId: session.id,
              status: session.status,
              crawlerPackage,
              generationError: generationResult.error,
            };
          }

          logger.info('Website generation completed successfully', {
            sessionId,
            templateName: generationResult.template.name,
          });

          /*
           * IMPORTANT: Store chatInjection in temporary storage instead of returning it.
           * This prevents the massive template content (~100K+ tokens) from being stored
           * in message history, which would cause token explosion when reload() is called.
           *
           * The onStepFinish handler in api.chat.ts will retrieve this via
           * retrievePendingGenerationResult() and stream it via dataStream.
           */
          storePendingGenerationResult(sessionId, generationResult);

          return {
            success: true,
            message: `Great! I've selected the "${generationResult.template.name}" template for your ${generationResult.crawlerOutput.business_intelligence.industry_context.primary_category}. Now let me set up your website...`,
            sessionId: session.id,
            status: session.status,
            generation: {
              templateName: generationResult.template.name,
              themeId: generationResult.template.themeId,
              title: generationResult.template.title,
              reasoning: generationResult.template.reasoning,
              businessName: generationResult.crawlerOutput.business_intelligence.core_identity.brand_display_name,
              category: generationResult.crawlerOutput.business_intelligence.industry_context.primary_category,
            },

            /* Note: chatInjection is NOT included here - retrieved from pendingGenerationResults */
            hasPendingInjection: true,
          };
        } catch (error) {
          logger.error('Website generation threw an exception', error);

          return {
            success: true,
            message:
              'Information collected successfully! Website generation encountered an unexpected error. Your data is saved.',
            sessionId: session.id,
            status: session.status,
            crawlerPackage,
            generationError: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    }),

    /**
     * Delete a session (FR-015)
     */
    deleteSession: tool({
      description: 'Delete an information collection session when user requests it.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID to delete'),
      }),
      execute: async ({ sessionId }) => {
        logger.debug('deleteSession called', { sessionId });

        await infoCollectionService.deleteSession(sessionId, context.userId);

        return {
          success: true,
          message: 'Session deleted successfully.',
        };
      },
    }),

    /**
     * Get current session state
     */
    getSessionState: tool({
      description: 'Get the current state of the info collection session.',
      parameters: z.object({
        sessionId: z.string().describe('The session ID'),
      }),
      execute: async ({ sessionId }) => {
        const session = await infoCollectionService.getSession(sessionId);

        if (!session) {
          return { success: false, error: 'Session not found' };
        }

        return {
          success: true,
          session: {
            id: session.id,
            currentStep: session.currentStep,
            status: session.status,
            websiteUrl: session.websiteUrl,
            googleMapsUrl: session.googleMapsUrl,
            description: session.websiteDescription,
          },
        };
      },
    }),
  };
}

// Type export for use in API route
export type InfoCollectionTools = ReturnType<typeof createInfoCollectionTools>;

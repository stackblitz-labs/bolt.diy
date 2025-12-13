/**
 * Website Generation Service
 * Orchestrates the website generation pipeline after info collection
 *
 * Flow:
 * 1. Get crawler data (mock or real)
 * 2. Select best template based on business profile
 * 3. Transform content for template injection
 * 4. Load template files and prepare chat injection
 */

import type { CrawlerDataPackage, CrawlerOutput, GenerationResult } from '~/types/info-collection';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import type { ProviderInfo } from '~/types/model';
import { getCrawlerData } from './crawlerService';
import { selectTemplateFromCrawlerData } from '~/utils/selectStarterTemplate';
import { transformToTemplateContent, generateContentFileCode } from './contentTransformer';
import { STARTER_TEMPLATES } from '~/utils/constants';
import { getThemePrompt } from '~/theme-prompts/registry';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('WebsiteGenerationService');

/*
 * ============================================================================
 * Configuration
 * ============================================================================
 */

interface GenerationOptions {
  crawlerPackage: CrawlerDataPackage;
  model: string;
  provider: ProviderInfo;
}

/*
 * ============================================================================
 * Template Loading (Server-side version)
 * ============================================================================
 */

/**
 * Fetch template files from GitHub via API
 */
async function fetchTemplateFiles(
  githubRepo: string,
  baseUrl: string,
): Promise<{ name: string; path: string; content: string }[]> {
  logger.info(`Fetching template files from: ${githubRepo}`);

  const response = await fetch(`${baseUrl}/api/github-template?repo=${encodeURIComponent(githubRepo)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status}`);
  }

  const files = (await response.json()) as { name: string; path: string; content: string }[];

  logger.info(`Fetched ${files.length} files from template`);

  return files;
}

/**
 * Filter template files (remove .git, .bolt directories)
 */
function filterTemplateFiles(
  files: { name: string; path: string; content: string }[],
): { name: string; path: string; content: string }[] {
  return files.filter((file) => !file.path.startsWith('.git') && !file.path.startsWith('.bolt'));
}

/**
 * Build assistant message with template files
 */
function buildAssistantMessage(
  files: { path: string; content: string }[],
  templateName: string,
  title: string,
): string {
  return `
Bolt is initializing your project with the required files using the ${templateName} template.
<boltArtifact id="imported-files" title="${title}" type="bundled">
${files
  .map(
    (file) => `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
}

/**
 * Build user message with content injection instructions
 */
function buildUserMessage(themePrompt: string | null, contentCode: string, crawlerOutput: CrawlerOutput): string {
  const businessInfo = crawlerOutput.business_intelligence;
  const brandStrategy = crawlerOutput.brand_strategy;

  let message = '';

  // Add theme-specific instructions if available
  if (themePrompt) {
    message += `
TEMPLATE DESIGN INSTRUCTIONS:
${themePrompt}

---
`;
  }

  // Add business content for injection
  message += `
BUSINESS CONTENT TO INJECT:

Business Name: ${businessInfo.core_identity.brand_display_name}
Category: ${businessInfo.industry_context.primary_category}
Tagline: ${businessInfo.core_identity.tagline_inferred}

Contact Information:
- Address: ${businessInfo.nap_logistics.full_address}
- Phone: ${businessInfo.nap_logistics.phone_clickable}
- Booking: ${businessInfo.nap_logistics.booking_action_url}

Brand Voice: ${brandStrategy.tone_of_voice}
Target Audience: ${brandStrategy.target_audience_persona}
Unique Selling Point: ${brandStrategy.inferred_usp}

Features: ${businessInfo.industry_context.operational_highlights.join(', ')}

Rating: ${businessInfo.reputation_snapshot.average_rating} stars (${businessInfo.reputation_snapshot.total_reviews} reviews)

---

GENERATED CONTENT FILE (data/content.ts):
Please create or update the content file with this data:

\`\`\`typescript
${contentCode}
\`\`\`

---

INSTRUCTIONS:
1. The template has been imported with all necessary files
2. Update the content/data files with the business information above
3. Customize colors if needed:
   - Primary: ${crawlerOutput.visual_asset_strategy.color_palette_extracted.primary_hex}
   - Accent: ${crawlerOutput.visual_asset_strategy.color_palette_extracted.accent_hex}
4. Ensure all placeholder text is replaced with actual business content
5. Run \`npm install && npm run dev\` to start the development server

IMPORTANT: Do NOT edit core template files. Only modify content/data files and add new components if needed.
`;

  return message;
}

/*
 * ============================================================================
 * Main Generation Pipeline
 * ============================================================================
 */

/**
 * Run the complete website generation pipeline
 *
 * @param options - Generation options including crawler package and LLM config
 * @param baseUrl - Base URL for API calls (passed from request context)
 * @returns GenerationResult with template files and chat injection messages
 */
export async function generateWebsite(options: GenerationOptions, baseUrl: string): Promise<GenerationResult> {
  const { crawlerPackage, model, provider } = options;

  logger.info('Starting website generation pipeline', {
    sessionId: crawlerPackage.sessionId,
    userId: crawlerPackage.userId,
  });

  try {
    // Step 1: Get crawler data (mock for now)
    logger.info('Step 1: Fetching crawler data');

    const crawlerOutput = await getCrawlerData(crawlerPackage);

    // Step 2: Select best template
    logger.info('Step 2: Selecting template');

    const templateSelection = await selectTemplateFromCrawlerData({
      crawlerOutput,
      userDescription: crawlerPackage.userDescription,
      model,
      provider,
    });

    // Find template details
    const template = STARTER_TEMPLATES.find((t) => t.name === templateSelection.template);

    if (!template) {
      throw new Error(`Template not found: ${templateSelection.template}`);
    }

    const themeId = template.restaurantThemeId as RestaurantThemeId;

    if (!themeId) {
      throw new Error(`Template ${template.name} is not a restaurant template`);
    }

    logger.info('Template selected', {
      templateName: template.name,
      themeId,
      reasoning: templateSelection.reasoning,
    });

    // Step 3: Transform content
    logger.info('Step 3: Transforming content');

    const templateContent = transformToTemplateContent(crawlerOutput, themeId);
    const contentCode = generateContentFileCode(templateContent);

    // Step 4: Load template files
    logger.info('Step 4: Loading template files');

    const rawFiles = await fetchTemplateFiles(template.githubRepo, baseUrl);
    const files = filterTemplateFiles(rawFiles);

    // Step 5: Build chat injection messages
    logger.info('Step 5: Building chat messages');

    const themePrompt = getThemePrompt(themeId);
    const assistantMessage = buildAssistantMessage(files, template.name, templateSelection.title);
    const userMessage = buildUserMessage(themePrompt, contentCode, crawlerOutput);

    const result: GenerationResult = {
      success: true,
      sessionId: crawlerPackage.sessionId,
      template: {
        name: template.name,
        themeId,
        title: templateSelection.title,
        reasoning: templateSelection.reasoning,
      },
      crawlerOutput,
      chatInjection: {
        assistantMessage,
        userMessage,
      },
    };

    logger.info('Website generation pipeline completed successfully', {
      sessionId: crawlerPackage.sessionId,
      templateName: template.name,
      filesCount: files.length,
    });

    return result;
  } catch (error) {
    logger.error('Website generation pipeline failed', error);

    return {
      success: false,
      sessionId: crawlerPackage.sessionId,
      template: {
        name: '',
        themeId: 'artisanhearthv3' as RestaurantThemeId,
        title: '',
      },
      crawlerOutput: {} as CrawlerOutput,
      chatInjection: {
        assistantMessage: '',
        userMessage: '',
      },
      error: error instanceof Error ? error.message : 'Unknown error during generation',
    };
  }
}

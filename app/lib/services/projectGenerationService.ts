import type { IProviderSetting, ProviderInfo } from '~/types/model';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import type { BusinessProfile, SaveSnapshotResponse } from '~/types/project';
import type { GeneratedFile, GenerationSSEEvent } from '~/types/generation';
import type {
  BusinessData,
  ColorPalette,
  ContentSections,
  IndustryContext,
  Logo,
  Menu,
  Photo,
  ReputationData,
  Review,
  Typography,
} from '~/types/crawler';
import { createScopedLogger } from '~/utils/logger';
import { getThemeByTemplateName, getThemePrompt, RESTAURANT_THEMES } from '~/theme-prompts/registry';
import { streamText } from '~/lib/.server/llm/stream-text';
import { saveSnapshot } from '~/lib/services/projects.server';
import type { FileMap } from '~/lib/stores/files';
import { WORK_DIR, MODEL_REGEX, PROVIDER_REGEX, STARTER_TEMPLATES } from '~/utils/constants';
import { getFastModel } from '~/lib/services/fastModelResolver';
import { resolveTemplate, applyIgnorePatterns, buildTemplatePrimingMessages } from '~/lib/.server/templates';
import { createTrace, createGeneration, flushTraces, isLangfuseEnabled } from '~/lib/.server/telemetry/langfuse.server';

const logger = createScopedLogger('projectGenerationService');

export interface BusinessProfileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];

  /**
   * If `true`, generation can proceed using defaults for missing fields.
   * If `false`, generation should not proceed.
   */
  canProceedWithDefaults: boolean;
}

export function validateBusinessProfile(profile: BusinessProfile | null | undefined): BusinessProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile) {
    return { valid: false, errors: ['No business profile data'], warnings: [], canProceedWithDefaults: false };
  }

  // Check for either legacy data OR markdown
  const hasLegacyData = !!profile.crawled_data?.name || !!profile.generated_content?.businessIdentity?.displayName;
  const hasMarkdown = !!profile.google_maps_markdown;

  if (!hasLegacyData && !hasMarkdown) {
    errors.push('Business data is required (crawled_data or google_maps_markdown)');
  }

  // Warnings for missing optional data
  if (!profile.website_markdown && !profile.crawled_data?.website) {
    warnings.push('No website data available');
  }

  if (!profile.crawled_data?.address && !hasMarkdown) {
    warnings.push('Address not provided');
  }

  if (!profile.crawled_data?.phone && !hasMarkdown) {
    warnings.push('Phone not provided');
  }

  if (!profile.crawled_data?.hours && !hasMarkdown) {
    warnings.push('Hours not provided');
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    canProceedWithDefaults: valid,
  };
}

export interface TemplateSelection {
  themeId: RestaurantThemeId;
  name: string;
  title?: string;
  reasoning?: string;
}

type PriceTier = 'budget' | 'mid' | 'upscale' | 'luxury';

interface BusinessProfileAnalysis {
  cuisine: string;
  category: string;
  priceTier: PriceTier;
  style: string;
  keywords: string[];
  rating?: number;
  reviewsCount?: number;
}

export interface GenerationOptions {
  /**
   * User's configured model (Phase 2).
   */
  model: string;
  provider: ProviderInfo;

  /**
   * Optional override for fast model/provider (Phase 1).
   */
  fastModel?: string;
  fastProvider?: ProviderInfo;

  /**
   * Request/environment context (required for server generation).
   */
  baseUrl: string;
  cookieHeader: string | null;
  env?: Env;
  apiKeys: Record<string, string>;
  providerSettings: Record<string, IProviderSetting>;
  businessProfile: BusinessProfile;
}

/**
 * Main entrypoint for generating a website for a project.
 *
 * NOTE: Implemented in Phase 3 (US1). Phase 2 only provides the skeleton signature.
 */
export async function* generateProjectWebsite(
  _projectId: string,
  _userId: string,
  options: GenerationOptions,
): AsyncGenerator<GenerationSSEEvent> {
  const startedAt = Date.now();

  // Phase 1: Template selection
  yield {
    event: 'progress',
    data: {
      phase: 'template_selection',
      status: 'in_progress',
      message: 'Analyzing business details',
      percentage: 10,
      startedAt,
    },
  };

  const fastProvider = options.fastProvider ?? options.provider;
  const { model: fastModel } = options.fastModel
    ? { model: options.fastModel }
    : getFastModel(fastProvider, options.model);

  const phase1Start = Date.now();
  const selection = await selectTemplate(
    options.businessProfile,
    fastModel,
    fastProvider,
    options.baseUrl,
    options.cookieHeader,
  );
  const phase1Ms = Date.now() - phase1Start;

  yield {
    event: 'progress',
    data: {
      phase: 'template_selection',
      status: 'completed',
      message: `Template selected: ${selection.name}`,
      percentage: 20,
      startedAt,
      templateName: selection.name,
    },
  };

  yield {
    event: 'template_selected',
    data: {
      name: selection.name,
      themeId: selection.themeId,
      reasoning: selection.reasoning ?? '',
    },
  };

  // Phase 2: Content generation
  yield {
    event: 'progress',
    data: {
      phase: 'content_generation',
      status: 'in_progress',
      message: 'Generating layout & copy',
      percentage: 30,
      startedAt,
      templateName: selection.name,
    },
  };

  const files: GeneratedFile[] = [];
  const phase2Start = Date.now();

  for await (const fileEvent of generateContent(
    options.businessProfile,
    selection.themeId,
    options.model,
    options.provider,
    options.env,
    options.apiKeys,
    options.providerSettings,
  )) {
    files.push(fileEvent.data);
    yield fileEvent;
  }

  const phase2Ms = Date.now() - phase2Start;

  yield {
    event: 'progress',
    data: {
      phase: 'content_generation',
      status: 'in_progress',
      message: 'Final polish & SEO check',
      percentage: 80,
      startedAt,
      templateName: selection.name,
    },
  };

  // Save snapshot (server-side)
  let snapshotUpdatedAt: string | null = null;
  let snapshotError: string | null = null;

  try {
    const fileMap = buildFileMapFromGeneratedFiles(files);

    yield {
      event: 'progress',
      data: {
        phase: 'snapshot_save',
        status: 'in_progress',
        message: 'Saving project',
        percentage: 90,
        startedAt,
        templateName: selection.name,
      },
    };

    const resp = await saveGeneratedSnapshot(_projectId, fileMap, _userId);
    snapshotUpdatedAt = resp.updated_at;
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : String(error);
    logger.error('Snapshot save failed', { error: snapshotError, projectId: _projectId, userId: _userId });
  }

  const totalMs = Date.now() - startedAt;

  yield {
    event: 'complete',
    data: {
      success: true,
      projectId: _projectId,
      template: {
        name: selection.name,
        themeId: selection.themeId,
        title: selection.title ?? 'Website',
        reasoning: selection.reasoning,
      },
      files,
      snapshot: snapshotUpdatedAt
        ? { savedAt: snapshotUpdatedAt, fileCount: files.length, sizeMB: estimateFilesSizeMB(files) }
        : null,
      timing: {
        phase1Ms,
        phase2Ms,
        totalMs,
      },
      error: snapshotError ?? undefined,
    },
  };
}

/**
 * Phase 1: Template selection (fast LLM).
 *
 * NOTE: Implemented in Phase 3 (US1). Phase 2 only provides the skeleton signature.
 */
export async function selectTemplate(
  businessProfile: BusinessProfile,
  fastModel: string,
  provider: ProviderInfo,
  baseUrl: string,
  cookieHeader: string | null,
): Promise<TemplateSelection> {
  const analysis = analyzeBusinessProfile(businessProfile);

  logger.info('[TEMPLATE_SELECTION] Starting', {
    name: businessProfile.generated_content?.businessIdentity?.displayName || businessProfile.crawled_data?.name,
    category: analysis.category,
    cuisine: analysis.cuisine,
    priceTier: analysis.priceTier,
    style: analysis.style,
    rating: analysis.rating,
    reviewsCount: analysis.reviewsCount,
    provider: provider.name,
    model: fastModel,
  });

  const fallback: TemplateSelection = {
    themeId: 'indochineluxe',
    name: 'Indochine Luxe',
    title: 'Restaurant Website',
    reasoning: 'Fallback template used due to selection failure.',
  };

  try {
    const system = buildTemplateSelectionSystemPrompt();
    const message = buildTemplateSelectionContextPrompt(businessProfile);

    const response = await fetch(new URL('/api/llmcall', baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        system,
        message,
        model: fastModel,
        provider,
      }),
    });

    if (!response.ok) {
      logger.warn('[TEMPLATE_SELECTION] LLM call failed, falling back', {
        status: response.status,
        statusText: response.statusText,
      });
      return fallback;
    }

    const respJson = (await response.json()) as { text?: string };
    const parsed = parseTemplateSelection(respJson.text ?? '');

    if (!parsed) {
      logger.warn('[TEMPLATE_SELECTION] Could not parse LLM output, falling back', { text: respJson.text ?? '' });
      return fallback;
    }

    const theme = getThemeByTemplateName(parsed.templateName);

    if (!theme) {
      logger.warn('[TEMPLATE_SELECTION] Unknown template returned, falling back', {
        templateName: parsed.templateName,
      });
      return fallback;
    }

    logger.info('[TEMPLATE_SELECTION] Selected', {
      themeId: theme.id,
      templateName: theme.templateName,
      reasoning: parsed.reasoning,
      title: parsed.title,
      analysis,
    });

    return {
      themeId: theme.id,
      name: theme.templateName,
      title: parsed.title ?? 'Restaurant Website',
      reasoning: parsed.reasoning,
    };
  } catch {
    return fallback;
  }
}

/**
 * Phase 2: Content generation (user's LLM), streamed as file events.
 *
 * This function fetches the GitHub template associated with the themeId,
 * primes the LLM with the template files, and asks it to customize
 * (not regenerate) the template with business data.
 */
export async function* generateContent(
  businessProfile: BusinessProfile,
  themeId: RestaurantThemeId,
  model: string,
  provider: ProviderInfo,
  env: Env | undefined,
  apiKeys: Record<string, string>,
  providerSettings: Record<string, IProviderSetting>,
): AsyncGenerator<{ event: 'file'; data: GeneratedFile }> {
  const themePrompt = getThemePrompt(themeId) ?? '';

  const businessName =
    businessProfile.generated_content?.businessIdentity?.displayName ||
    businessProfile.crawled_data?.name ||
    'Restaurant';

  // Create Langfuse trace for content generation
  const traceContext = createTrace(env, {
    name: 'content-generation',
    metadata: { themeId, model, provider: provider.name, businessName },
    input: { businessName, themeId, model },
  });

  // Look up template in STARTER_TEMPLATES by themeId
  const template = STARTER_TEMPLATES.find((t) => t.restaurantThemeId === themeId);

  if (!template) {
    throw new Error(`[TEMPLATE_PRIMING] Template not found for themeId: ${themeId}`);
  }

  logger.info(`[TEMPLATE_PRIMING] Using template: ${template.name} (${template.githubRepo})`);

  // Resolve template from zip or GitHub
  let assistantMessage: string;
  let userMessage: string;

  try {
    const githubToken = env?.GITHUB_TOKEN;
    const resolved = await resolveTemplate(template.name, {
      githubRepo: template.githubRepo,
      githubToken,
    });
    const allFiles = resolved.files;

    logger.info(`[TEMPLATE_PRIMING] Template loaded from ${resolved.source.type}: ${allFiles.length} files`);

    // Apply ignore patterns
    const { includedFiles, ignoredFiles } = applyIgnorePatterns(allFiles);

    logger.info(`[TEMPLATE_PRIMING] After filtering: ${includedFiles.length} included, ${ignoredFiles.length} ignored`);

    // Build priming messages
    const title = businessProfile.generated_content?.businessIdentity?.displayName
      ? `${businessProfile.generated_content.businessIdentity.displayName} Website`
      : 'Restaurant Website';

    const primingMessages = buildTemplatePrimingMessages(
      includedFiles,
      ignoredFiles,
      businessProfile,
      template.name,
      themePrompt,
      title,
    );

    assistantMessage = primingMessages.assistantMessage;
    userMessage = primingMessages.userMessage;
  } catch (error) {
    // Fallback to from-scratch generation if template resolution fails
    logger.warn('[TEMPLATE_PRIMING] Template resolution failed, falling back to from-scratch generation', {
      error: error instanceof Error ? error.message : String(error),
    });

    assistantMessage = '';
    userMessage = buildFallbackUserMessage(businessName, model, provider.name);
  }

  // Compose additional system prompt with theme and business data
  const additionalSystemPrompt = composeContentPrompt(businessProfile, themePrompt);

  // Build messages array - include assistant message if we have template content
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (assistantMessage) {
    messages.push({ role: 'assistant', content: assistantMessage });

    /*
     * CRITICAL: Yield template files FIRST so they're in the snapshot
     * LLM modifications will overwrite files with the same paths
     */
    const templateFiles = extractFileActionsFromBuffer(assistantMessage);

    logger.info(`[CONTENT_GEN] Template files (${templateFiles.files.length}):`);

    for (const file of templateFiles.files) {
      logger.info(`  [TEMPLATE] ${file.path} (${file.content.length} chars)`);
      yield { event: 'file', data: file };
    }

    // Check if template includes App.tsx
    const templateAppTsx = templateFiles.files.find((f) => f.path.includes('App.tsx'));

    if (templateAppTsx) {
      logger.info(`[DEBUG] Template App.tsx found at: ${templateAppTsx.path}`);
      logger.info(`[DEBUG] Template App.tsx preview: ${templateAppTsx.content.substring(0, 200)}...`);
    } else {
      logger.warn(`[DEBUG] No App.tsx found in template files!`);
    }

    logger.info(`[CONTENT_GEN] Yielded ${templateFiles.files.length} template files`);
  }

  // Add model/provider markers to user message for streamText() parsing
  const fullUserMessage = [`[Model: ${model}]`, '', `[Provider: ${provider.name}]`, '', userMessage].join('\n');

  messages.push({ role: 'user', content: fullUserMessage });

  // Create Langfuse generation for streamText - capt`ure full input
  const generation = traceContext
    ? createGeneration(env, traceContext, {
        name: 'stream-text-content',
        model,
        input: {
          userMessage,
          templateName: template?.name,
          businessName,
          themeId,
          additionalSystemPrompt,
        },
      })
    : null;
  const startTime = performance.now();

  /*
   * streamText() returns an AI SDK stream result with a `textStream` we can parse incrementally.
   * We inject the theme prompt ourselves via `composeContentPrompt` to keep a single source of truth.
   */
  const result = await streamText({
    messages,
    env,
    apiKeys,
    providerSettings,
    chatMode: 'build',
    restaurantThemeId: themeId,
    additionalSystemPrompt,
  });

  const reader = result.textStream.getReader();
  let buffer = '';
  let fullOutput = ''; // Accumulate full LLM output for Langfuse

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      // `textStream` yields string chunks (not bytes).
      buffer += value;
      fullOutput += value; // Capture full output for Langfuse

      /*
       * Extract complete <boltAction ...>...</boltAction> blocks and emit file actions.
       * Keep any trailing partial block in the buffer for the next chunk.
       */
      const extracted = extractFileActionsFromBuffer(buffer);
      buffer = extracted.remaining;

      for (const file of extracted.files) {
        logger.info(`  [LLM] ${file.path} (${file.content.length} chars)`);

        // Check if LLM is generating App.tsx (potential overwrite of template)
        if (file.path.includes('App.tsx')) {
          logger.warn(`[DEBUG] LLM generated App.tsx at: ${file.path}`);
          logger.warn(`[DEBUG] LLM App.tsx preview: ${file.content.substring(0, 200)}...`);
        }

        yield { event: 'file', data: file };
      }
    }
  } finally {
    reader.releaseLock();

    // End Langfuse generation with full output
    generation?.end({
      latencyMs: performance.now() - startTime,
      output: fullOutput,
      provider: provider.name,
    });

    // Flush Langfuse traces
    if (isLangfuseEnabled(env)) {
      flushTraces(env).catch((err) => logger.error('Failed to flush Langfuse traces', err));
    }
  }
}

/**
 * Fallback user message when GitHub template fetch fails.
 * This reverts to the original from-scratch generation behavior.
 */
function buildFallbackUserMessage(businessName: string, _model: string, _providerName: string): string {
  return [
    `Generate a complete production-ready restaurant website for "${businessName}".`,
    '',
    'Use the theme design instructions and business profile provided in the system prompt.',
    'Generate all required files including App.tsx, components, and styles.',
    'Replace ALL placeholder content with actual business data - no lorem ipsum or generic text.',
    '',
    'Begin generating files now.',
    '',
    '## CRITICAL: OUTPUT FORMAT REQUIREMENTS',
    '',
    'You MUST use EXACTLY this format when generating files:',
    '',
    '<boltAction type="file" filePath="path/to/file.ts">',
    'file content goes here',
    '</boltAction>',
    '',
    '**FORBIDDEN FORMATS** (these will NOT be parsed):',
    '- DO NOT use <function_calls> tags',
    '- DO NOT use <invoke> tags',
    '- DO NOT use <parameter> tags',
    '- DO NOT put content in markdown code fences outside the tags',
    '',
    'The content must be INSIDE the <boltAction>...</boltAction> tags.',
  ].join('\n');
}

/**
 * Auto-save generated output to the initial project snapshot.
 *
 * NOTE: Implemented in Phase 3 (US1). Phase 2 only provides the skeleton signature.
 */
export async function saveGeneratedSnapshot(
  projectId: string,
  files: FileMap,
  userId: string,
): Promise<SaveSnapshotResponse> {
  return await saveSnapshot(projectId, { files }, userId);
}

function buildTemplateSelectionSystemPrompt(): string {
  const themesText = RESTAURANT_THEMES.map((t) => {
    return [
      '<template>',
      `  <name>${t.templateName}</name>`,
      `  <description>${t.description}</description>`,
      `  <cuisines>${t.cuisines.join(', ')}</cuisines>`,
      `  <style>${t.styleTags.join(', ')}</style>`,
      '</template>',
    ].join('\n');
  }).join('\n\n');

  return `
You are selecting the best restaurant website template for a business.

Available Templates:
${themesText}

Select the SINGLE best matching template. Consider (in order):
1. Cuisine alignment (e.g., Vietnamese vs Chinese vs Mediterranean)
2. Price tier / experience (budget, mid, upscale, luxury)
3. Brand style (minimalist, rustic, vibrant, dark-luxe, botanical, etc.)
4. Ambiance keywords (cozy, romantic, modern, energetic, elegant)

Examples (guidance, not strict rules):
- Fine dining + French/luxury → Noir Luxe v3 OR Classic Minimalist v2
- Casual + Asian → Bamboo Bistro OR Indochine Luxe
- Street food + vibrant/urban → Chromatic Street OR The Red Noodle

Response format:
<selection>
  <templateName>{exact template name from list}</templateName>
  <reasoning>{1-2 sentence explanation}</reasoning>
  <title>{a short site title}</title>
</selection>

Important: Provide only the selection tags in your response, no additional text.
`.trim();
}

function buildTemplateSelectionContextPrompt(profile: BusinessProfile): string {
  const analysis = analyzeBusinessProfile(profile);
  const name = profile.generated_content?.businessIdentity?.displayName || profile.crawled_data?.name || '';
  const tone = profile.generated_content?.brandStrategy?.toneOfVoice || '';
  const visualStyle = profile.generated_content?.brandStrategy?.visualStyle || '';
  const menuCategoryNames = profile.crawled_data?.menu?.categories?.map((c) => c.name).slice(0, 8) ?? [];
  const menuHint = menuCategoryNames.length ? `- Menu Categories: ${menuCategoryNames.join(', ')}` : '';
  const ratingHint = analysis.rating
    ? `- Rating: ${analysis.rating}${analysis.reviewsCount ? ` (${analysis.reviewsCount} reviews)` : ''}`
    : '';

  return `
Business Profile:
- Name: ${name}
- Category: ${analysis.category}
- Cuisine: ${analysis.cuisine}
- Price Tier: ${analysis.priceTier}
- Style: ${analysis.style}
- Keywords: ${analysis.keywords.join(', ')}
- Tone: ${tone}
- Visual Style: ${visualStyle}
${ratingHint}
${menuHint}
`.trim();
}

function parseTemplateSelection(
  llmOutput: string,
): { templateName: string; reasoning?: string; title?: string } | null {
  const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
  const reasoningMatch = llmOutput.match(/<reasoning>(.*?)<\/reasoning>/);
  const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

  if (!templateNameMatch) {
    return null;
  }

  return {
    templateName: templateNameMatch[1].trim(),
    reasoning: reasoningMatch?.[1]?.trim(),
    title: titleMatch?.[1]?.trim(),
  };
}

function composeContentPrompt(businessProfile: BusinessProfile, _themePrompt?: string): string {
  /*
   * NOTE: themePrompt parameter is kept for backward compatibility but is no longer used.
   * Theme injection is handled in stream-text.ts via restaurantThemeId to avoid duplication.
   * Check if we have enhanced markdown content
   */
  const hasMarkdown = !!businessProfile.google_maps_markdown;

  if (hasMarkdown) {
    /*
     * Use markdown content directly (enhanced flow)
     * NOTE: Theme prompt is NOT included here - it's injected in stream-text.ts via restaurantThemeId
     * to avoid duplication. This function only provides business context data.
     */
    const hasWebsiteAnalysis = !!businessProfile.website_markdown;

    // Log graceful degradation when website analysis is not available
    if (!hasWebsiteAnalysis) {
      logger.info(`[CONTENT_GEN] Generating without website analysis (graceful degradation)`);
    }

    const websiteAnalysisSection = hasWebsiteAnalysis
      ? `
<existing_website_analysis>
${businessProfile.website_markdown}
</existing_website_analysis>

Use the existing website analysis to match visual style and tone where appropriate.
`
      : '';

    return `
---
BUSINESS PROFILE (REFERENCE DATA)

Use the following data as the primary source of truth for generating website content.

INSTRUCTIONS:
- Extract exact business name, address, phone, hours, and menu items from this data
- Integrate relevant facts naturally into website copy - do NOT paste verbatim
- If details are missing, use sensible defaults without inventing specific claims
- This data takes precedence over any conflicting template placeholders

<google_maps_data>
${businessProfile.google_maps_markdown}
</google_maps_data>
${websiteAnalysisSection}
---

CONTENT REQUIREMENTS:
1. MUST use the exact business name in header, footer, and meta title.
2. MUST use the exact address and phone in the Contact section if provided.
3. MUST use provided hours if available.
4. MUST replace ALL placeholders with business data (no lorem ipsum).
5. MUST generate complete file contents (no TODOs).
6. SHOULD use the website analysis to match visual style if available.

TASK: Generate a complete, production-ready restaurant website using the business information above.
`.trim();
  }

  /*
   * Fall back to legacy formatting (existing projects with crawled_data)
   * NOTE: Theme prompt is NOT included here - it's injected in stream-text.ts via restaurantThemeId
   * to avoid duplication. This function only provides business context data.
   */
  const generated = businessProfile.generated_content;
  const crawled = businessProfile.crawled_data;
  const brandStrategy = generated?.brandStrategy;
  const visualAssets = generated?.visualAssets;

  const toneOfVoice = brandStrategy?.toneOfVoice || '';
  const usp = brandStrategy?.usp || '';
  const targetAudience = brandStrategy?.targetAudience || '';
  const visualStyle = brandStrategy?.visualStyle || '';

  const colorPalette = visualAssets?.colorPalette;
  const typography = visualAssets?.typography;

  const formattedBusinessProfile = formatBusinessDataForPrompt(businessProfile);

  const brandVoiceLine = toneOfVoice ? `Write all copy in a "${toneOfVoice}" voice.` : '';
  const uspLine = usp ? `Primary USP: ${usp}` : '';
  const targetAudienceLine = targetAudience ? `Target audience: ${targetAudience}` : '';
  const visualStyleLine = visualStyle ? `Visual style: ${visualStyle}` : '';

  return `
---
BUSINESS PROFILE (REFERENCE DATA)

Use the following data as the primary source of truth for generating website content.

INSTRUCTIONS:
- Extract exact business name, address, phone, hours, and menu items from this data
- Integrate relevant facts naturally into website copy - do NOT paste verbatim
- If details are missing, use sensible defaults without inventing specific claims
- This data takes precedence over any conflicting template placeholders

BRAND VOICE:
${[brandVoiceLine, uspLine, targetAudienceLine, visualStyleLine].filter(Boolean).join('\n') || 'N/A'}

INDUSTRY CONTEXT:
${formatIndustryContextForPrompt(generated?.industryContext)}

REPUTATION & RATINGS:
${formatReputationDataForPrompt(generated?.reputationData, crawled)}

COLOR PALETTE (if provided):
${formatColorPaletteForPrompt(colorPalette)}

TYPOGRAPHY (if provided):
${formatTypographyForPrompt(typography)}

LOGO (if provided):
${formatLogoForPrompt(visualAssets?.logo)}

<business_profile>
${formattedBusinessProfile}
</business_profile>

PRE-GENERATED CONTENT SUGGESTIONS (use as inspiration):
${formatContentSectionsForPrompt(generated?.contentSections)}

<full_business_profile_json>
${JSON.stringify(businessProfile, null, 2)}
</full_business_profile_json>
---

DATA USAGE INSTRUCTIONS:
1. **Photos**: Use REAL image URLs from crawled_data.visual_content.image_collections:
   - food: Use for menu section, hero backgrounds
   - exterior: Use for hero section, about section
   - interior: Use for atmosphere/ambiance section
   - owner_uploads: High-quality official photos, prioritize these

2. **Attributes**: Extract from crawled_data.operational_data.attributes:
   - atmosphere: Use for describing the vibe (e.g., "Casual", "Cozy", "Trendy")
   - offerings: Highlight in about section (e.g., "Vegetarian options", "Happy hour")
   - highlights: Feature prominently (e.g., "Fast service")
   - popular_for: Mention in hero/about (e.g., "Perfect for Lunch, Dinner, Solo dining")
   - accessibility: Include in footer/contact (wheelchair accessible, etc.)

3. **Reviews**: Use crawled_data.reviews_data.top_relevant_reviews:
   - Extract 2-3 compelling quotes for testimonials section
   - Use author_name for attribution
   - Select reviews that highlight different strengths (food quality, service, atmosphere)

4. **Menu**: Use crawled_data.operational_data.menu for complete menu section:
   - Include ALL menu items with actual prices
   - Group logically if categories aren't provided
   - Use exact item names and prices from the data

5. **Business Info**: Use crawled_data.operational_data for accurate details:
   - phone_number: Exact phone number
   - address_formatted: Full address
   - open_hours_raw: Actual operating hours
   - website_url_listed: Link to official website

CONTENT REQUIREMENTS:
1. MUST use the exact business name in header, footer, and meta title.
2. MUST use the exact address and phone in the Contact section if provided.
3. MUST use provided hours if available; otherwise display a sensible default message.
4. MUST replace ALL placeholders in the template with business data (no lorem ipsum).
5. MUST generate complete file contents (no TODOs).
6. SHOULD incorporate the USP into the hero + about copy.
7. SHOULD apply the provided color palette and typography (if present) while respecting the theme layout.
8. SHOULD use the pre-generated content sections as a starting point for copy.
9. SHOULD display rating/reviews count if available (e.g., "4.8★ from 120 reviews").

TASK: Generate a complete, production-ready restaurant website using the business information above.

Include sections: Hero, About, Menu, Contact, Footer.
`.trim();
}

function analyzeBusinessProfile(profile: BusinessProfile): BusinessProfileAnalysis {
  const generated = profile.generated_content;
  const crawled = profile.crawled_data;

  const categories = generated?.industryContext?.categories ?? [];
  const category = categories[0] ?? 'restaurant';

  const cuisineCandidates = [...categories].map((c) => c.trim().toLowerCase()).filter(Boolean);
  const menuCategories = crawled?.menu?.categories?.map((c) => c.name.trim().toLowerCase()) ?? [];

  const cuisine = [...cuisineCandidates, ...menuCategories][0] ?? category;

  const rating = generated?.reputationData?.averageRating ?? crawled?.rating;
  const reviewsCount = generated?.reputationData?.reviewsCount ?? crawled?.reviews_count;

  const pricingTier = generated?.industryContext?.pricingTier?.toLowerCase() ?? '';
  const priceTier = inferPriceTier({ pricingTier, rating });

  const tone = generated?.brandStrategy?.toneOfVoice?.toLowerCase() ?? '';
  const visualStyle = generated?.brandStrategy?.visualStyle?.toLowerCase() ?? '';

  const reviewText = (crawled?.reviews ?? [])
    .map((r) => r.text)
    .filter(Boolean)
    .slice(0, 10)
    .join(' ')
    .toLowerCase();

  const inferredStyle = inferStyle({
    category,
    cuisine,
    pricingTier,
    tone,
    visualStyle,
    reviewText,
  });

  const keywords = Array.from(
    new Set(
      [
        category,
        cuisine,
        priceTier,
        inferredStyle,
        ...extractStyleKeywords(reviewText),
        ...extractStyleKeywords(`${tone} ${visualStyle}`),
      ]
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);

  return {
    cuisine,
    category,
    priceTier,
    style: inferredStyle,
    keywords,
    rating: typeof rating === 'number' ? rating : undefined,
    reviewsCount: typeof reviewsCount === 'number' ? reviewsCount : undefined,
  };
}

function formatBusinessDataForPrompt(profile: BusinessProfile): string {
  const defaults = {
    name: 'Restaurant Name',
    address: '123 Main Street',
    phone: '(555) 123-4567',
    hours: 'Contact us for hours',
  } as const;

  const crawled = profile.crawled_data;
  const generated = profile.generated_content;

  const displayName = generated?.businessIdentity?.displayName || crawled?.name || defaults.name;
  const legalName = generated?.businessIdentity?.legalName || '';
  const tagline = generated?.businessIdentity?.tagline || '';
  const description = generated?.businessIdentity?.description || '';

  const address = crawled?.address || defaults.address;
  const phone = crawled?.phone || defaults.phone;
  const website = crawled?.website || generated?.extractedData?.websiteUrl || '';

  const hoursLines = crawled?.hours
    ? Object.entries(crawled.hours)
        .slice(0, 7)
        .map(([day, value]) => `- ${day}: ${value}`)
        .join('\n')
    : `- ${defaults.hours}`;

  const missingFields: string[] = [];

  if (!generated?.businessIdentity?.displayName && !crawled?.name) {
    missingFields.push('name');
  }

  if (!crawled?.address) {
    missingFields.push('address');
  }

  if (!crawled?.phone) {
    missingFields.push('phone');
  }

  if (!crawled?.hours) {
    missingFields.push('hours');
  }

  const menuText = formatMenuForPrompt(crawled?.menu);
  const reviewsText = formatReviewsForPrompt(crawled?.reviews);
  const photosText = formatPhotosForPrompt(crawled?.photos);

  const defaultsUsedMap: Record<string, string> = {
    name: `name="${defaults.name}"`,
    address: `address="${defaults.address}"`,
    phone: `phone="${defaults.phone}"`,
    hours: `hours="${defaults.hours}"`,
  };

  const defaultsNote =
    missingFields.length > 0
      ? `DEFAULTS USED (because data was missing): ${missingFields.map((f) => defaultsUsedMap[f] ?? f).join(', ')}`
      : 'DEFAULTS USED: none';

  return [
    `BASIC INFO:`,
    `- Display Name: ${displayName}`,
    legalName ? `- Legal Name: ${legalName}` : null,
    tagline ? `- Tagline: ${tagline}` : null,
    description ? `- Description: ${description}` : null,
    '',
    `CONTACT:`,
    `- Address: ${address}`,
    `- Phone: ${phone}`,
    website ? `- Website: ${website}` : null,
    '',
    `HOURS:`,
    hoursLines,
    '',
    defaultsNote,
    '',
    `MENU (if provided):`,
    menuText,
    '',
    `REVIEWS (if provided):`,
    reviewsText,
    '',
    `PHOTOS (if provided):`,
    photosText,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
    .trim();
}

function formatMenuForPrompt(menu: Menu | undefined): string {
  if (!menu?.categories?.length) {
    return 'N/A';
  }

  return menu.categories
    .slice(0, 4)
    .map((category) => {
      const items = category.items
        .slice(0, 6)
        .map((item) => {
          const price = item.price ? ` (${item.price})` : '';
          const desc = item.description ? ` — ${item.description}` : '';

          return `  - ${item.name}${price}${desc}`;
        })
        .join('\n');

      return `- ${category.name}\n${items || '  - N/A'}`;
    })
    .join('\n');
}

function formatReviewsForPrompt(reviews: Review[] | undefined): string {
  if (!reviews?.length) {
    return 'N/A';
  }

  const filtered = reviews
    .filter((r) => typeof r.text === 'string' && r.text.trim().length > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)
    .map((r) => {
      const author = r.author ? ` — ${r.author}` : '';
      const rating = typeof r.rating === 'number' ? ` (${r.rating}/5)` : '';

      return `- "${r.text.trim()}"${author}${rating}`;
    });

  return filtered.length ? filtered.join('\n') : 'N/A';
}

function formatPhotosForPrompt(photos: Photo[] | undefined): string {
  if (!photos?.length) {
    return 'N/A';
  }

  const urls = photos
    .map((p) => p.url)
    .filter((u) => typeof u === 'string' && u.trim().length > 0)
    .slice(0, 6);

  return urls.length ? urls.map((u) => `- ${u}`).join('\n') : 'N/A';
}

function formatColorPaletteForPrompt(palette: ColorPalette | undefined): string {
  if (!palette) {
    return 'N/A';
  }

  const lines = [
    palette.primary ? `- Primary: ${palette.primary} (headers, CTAs, key elements)` : null,
    palette.secondary ? `- Secondary: ${palette.secondary} (accents, borders)` : null,
    palette.accent ? `- Accent: ${palette.accent} (highlights)` : null,
    Array.isArray(palette.background) && palette.background.length
      ? `- Background: ${palette.background.join(', ')}`
      : null,
    Array.isArray(palette.text) && palette.text.length ? `- Text: ${palette.text.join(', ')}` : null,
  ].filter((line): line is string => Boolean(line));

  const text = lines.join('\n').trim();

  return text.length ? text : 'N/A';
}

function formatTypographyForPrompt(typography: Typography | undefined): string {
  if (!typography) {
    return 'N/A';
  }

  const lines = [
    typography.headingFont ? `- Heading font: ${typography.headingFont}` : null,
    typography.bodyFont ? `- Body font: ${typography.bodyFont}` : null,
    Array.isArray(typography.allFonts) && typography.allFonts.length
      ? `- All fonts: ${typography.allFonts.join(', ')}`
      : null,
  ].filter((line): line is string => Boolean(line));

  const text = lines.join('\n').trim();

  return text.length ? text : 'N/A';
}

function formatIndustryContextForPrompt(context: IndustryContext | undefined): string {
  if (!context) {
    return 'N/A';
  }

  const lines = [
    context.categories?.length ? `- Categories: ${context.categories.join(', ')}` : null,
    context.pricingTier ? `- Pricing Tier: ${context.pricingTier}` : null,
    context.operationalHighlights?.length ? `- Highlights: ${context.operationalHighlights.join(', ')}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length ? lines.join('\n') : 'N/A';
}

function formatReputationDataForPrompt(
  reputation: ReputationData | undefined,
  crawled: BusinessData | undefined,
): string {
  const rating = reputation?.averageRating ?? crawled?.rating;
  const count = reputation?.reviewsCount ?? crawled?.reviews_count;
  const badges = reputation?.trustBadges;

  const lines = [
    typeof rating === 'number' ? `- Average Rating: ${rating}/5` : null,
    typeof count === 'number' ? `- Total Reviews: ${count}` : null,
    badges?.length ? `- Trust Badges: ${badges.join(', ')}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length ? lines.join('\n') : 'N/A';
}

function formatContentSectionsForPrompt(sections: ContentSections | undefined): string {
  if (!sections) {
    return 'N/A';
  }

  const parts: string[] = [];

  if (sections.hero) {
    const heroLines = [`HERO:`, `- Heading: ${sections.hero.heading}`];

    if (sections.hero.subheading) {
      heroLines.push(`- Subheading: ${sections.hero.subheading}`);
    }

    parts.push(heroLines.join('\n'));
  }

  if (sections.about) {
    parts.push(`ABOUT:\n- Heading: ${sections.about.heading}\n- Content: ${sections.about.content}`);
  }

  if (sections.products?.items?.length) {
    const items = sections.products.items
      .slice(0, 6)
      .map((p) => `  - ${p.name}${p.description ? `: ${p.description}` : ''}`)
      .join('\n');
    parts.push(`PRODUCTS:\n- Heading: ${sections.products.heading}\n${items}`);
  }

  return parts.length ? parts.join('\n\n') : 'N/A';
}

function formatLogoForPrompt(logo: Logo | undefined): string {
  if (!logo?.url) {
    return 'N/A';
  }

  const lines = [
    `- URL: ${logo.url}`,
    logo.source ? `- Source: ${logo.source}` : null,
    logo.description ? `- Description: ${logo.description}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

function inferPriceTier(input: { pricingTier: string; rating?: number }): PriceTier {
  const pricing = input.pricingTier;

  if (pricing.includes('$$$$') || pricing.includes('lux') || pricing.includes('premium')) {
    return 'luxury';
  }

  if (pricing.includes('$$$') || pricing.includes('fine') || pricing.includes('upscale')) {
    return 'upscale';
  }

  if (pricing.includes('$$') || pricing.includes('mid')) {
    return 'mid';
  }

  if (pricing.includes('$') || pricing.includes('budget') || pricing.includes('cheap')) {
    return 'budget';
  }

  const rating = input.rating;

  if (typeof rating === 'number') {
    if (rating >= 4.7) {
      return 'upscale';
    }

    if (rating >= 4.3) {
      return 'mid';
    }
  }

  return 'mid';
}

function inferStyle(input: {
  category: string;
  cuisine: string;
  pricingTier: string;
  tone: string;
  visualStyle: string;
  reviewText: string;
}): string {
  const haystack = `${input.category} ${input.cuisine} ${input.pricingTier} ${input.tone} ${input.visualStyle} ${input.reviewText}`;

  if (haystack.includes('street') || haystack.includes('food truck') || haystack.includes('noodle')) {
    return 'vibrant';
  }

  if (haystack.includes('fine dining') || haystack.includes('lux') || haystack.includes('tasting')) {
    return 'elegant';
  }

  if (haystack.includes('botanical') || haystack.includes('garden') || haystack.includes('fresh')) {
    return 'fresh';
  }

  if (haystack.includes('rustic') || haystack.includes('farm') || haystack.includes('hearth')) {
    return 'rustic';
  }

  if (haystack.includes('dark') || haystack.includes('noir') || haystack.includes('gold')) {
    return 'dark-luxe';
  }

  if (haystack.includes('minimal') || haystack.includes('clean') || haystack.includes('scandinavian')) {
    return 'minimalist';
  }

  return 'modern';
}

function extractStyleKeywords(text: string): string[] {
  const candidates = [
    'cozy',
    'romantic',
    'elegant',
    'modern',
    'vibrant',
    'minimal',
    'rustic',
    'luxury',
    'dark',
    'bright',
    'fresh',
    'botanical',
    'industrial',
    'casual',
    'refined',
    'warm',
  ];

  return candidates.filter((w) => text.includes(w));
}

function stripModelProviderMarkers(text: string): string {
  return text.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '');
}

function normalizeFilePath(filePath: string): string {
  const cleaned = stripModelProviderMarkers(filePath).trim();

  if (cleaned.startsWith('/')) {
    return cleaned;
  }

  return `${WORK_DIR}/${cleaned}`.replace(/\/+/g, '/');
}

function cleanBoltFileContent(content: string, filePath: string): string {
  const trimmed = stripModelProviderMarkers(content);

  // If the model wrapped content in a single markdown code fence, unwrap it.
  const match = trimmed.match(/^\s*```[\w-]*\n([\s\S]*?)\n\s*```\s*$/);
  const unwrapped = match ? match[1] : trimmed;

  // Unescape XML escaped tags that sometimes appear in streamed output.
  const unescaped = unwrapped.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  // Keep markdown files as-is (no trailing newline enforcement needed).
  if (filePath.endsWith('.md')) {
    return unescaped.trim();
  }

  return `${unescaped.trim()}\n`;
}

function extractFileActionsFromBuffer(input: string): { files: GeneratedFile[]; remaining: string } {
  const files: GeneratedFile[] = [];
  let cursor = 0;

  while (true) {
    const openIdx = input.indexOf('<boltAction', cursor);

    if (openIdx === -1) {
      break;
    }

    const closeIdx = input.indexOf('</boltAction>', openIdx);

    if (closeIdx === -1) {
      // Keep the partial block in remaining
      break;
    }

    const block = input.slice(openIdx, closeIdx + '</boltAction>'.length);
    cursor = closeIdx + '</boltAction>'.length;

    // Only process file actions
    if (!block.includes('type="file"')) {
      continue;
    }

    const filePathMatch = block.match(/filePath="([^"]+)"/);

    if (!filePathMatch) {
      continue;
    }

    const tagEnd = block.indexOf('>');
    const contentEnd = block.lastIndexOf('</boltAction>');

    if (tagEnd === -1 || contentEnd === -1 || contentEnd <= tagEnd) {
      continue;
    }

    const rawPath = filePathMatch[1];
    const rawContent = block.slice(tagEnd + 1, contentEnd);

    const normalizedPath = normalizeFilePath(rawPath);
    const cleanedContent = cleanBoltFileContent(rawContent, normalizedPath);

    files.push({
      path: normalizedPath,
      content: cleanedContent,
      size: cleanedContent.length,
    });
  }

  return {
    files,
    remaining: input.slice(cursor),
  };
}

function estimateFilesSizeMB(files: GeneratedFile[]): number {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  return Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
}

function buildFileMapFromGeneratedFiles(files: GeneratedFile[]): FileMap {
  const map: FileMap = {};
  const fileVersions: Map<string, { source: string; index: number; charCount: number }[]> = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = normalizeFilePath(file.path);

    // Track all versions of each file for debugging
    if (!fileVersions.has(fullPath)) {
      fileVersions.set(fullPath, []);
    }

    // Heuristic: first batch of files before any duplicates are likely template files
    const existingVersions = fileVersions.get(fullPath)!;
    const isLikelyTemplate = existingVersions.length === 0 && i < 50; // Assume first 50 unique files are template

    fileVersions.get(fullPath)!.push({
      source: isLikelyTemplate ? 'TEMPLATE' : 'LLM',
      index: i,
      charCount: file.content.length,
    });

    // Add folder entries
    const parts = fullPath.split('/').filter(Boolean);
    let current = '';

    for (let j = 0; j < parts.length - 1; j++) {
      current += `/${parts[j]}`;

      if (!map[current]) {
        map[current] = { type: 'folder' };
      }
    }

    map[fullPath] = {
      type: 'file',
      content: file.content,
      isBinary: false,
    };
  }

  // Log files that were overwritten
  for (const [path, versions] of fileVersions) {
    if (versions.length > 1) {
      const winner = versions[versions.length - 1];
      const versionSummary = versions.map((v) => `${v.source}@${v.index}(${v.charCount})`).join(' → ');
      logger.warn(`[FILE_MAP] ${path}: ${versions.length} versions [${versionSummary}], winner=${winner.source}`);
    }
  }

  const uniqueFiles = Object.entries(map).filter(([_, v]) => v?.type === 'file');
  logger.info(`[FILE_MAP] Final count: ${uniqueFiles.length} unique files from ${files.length} total entries`);

  return map;
}

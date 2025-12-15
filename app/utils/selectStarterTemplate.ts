import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import type { CrawlerOutput } from '~/types/info-collection';
import { STARTER_TEMPLATES } from './constants';
import { createScopedLogger } from '~/utils/logger';
import { getThemePrompt } from '~/theme-prompts/registry';

const logger = createScopedLogger('selectStarterTemplate');

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced developer who helps people choose the best starter template for their projects.
IMPORTANT: Restaurant templates have PRIORITY over generic templates when restaurant-related requests are detected.
IMPORTANT: Vite is preferred for non-restaurant projects
IMPORTANT: Only choose shadcn templates if the user explicitly asks for shadcn.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
  <category>generic</category>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
  ${template.category ? `<category>${template.category}</category>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project}</title>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>Vite React</templateName>
  <title>Simple React todo application</title>
</selection>
</example>

<example>
User: create a chinese restaurant website
Response:
<selection>
  <templateName>Bamboo Bistro</templateName>
  <title>Chinese Restaurant Website</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>script to generate numbers from 1 to 100</title>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, always recommend the blank template
2. **RESTAURANT PRIORITY**: If user mentions ANY restaurant, food, dining, or cuisine keywords, prioritize restaurant templates (category: restaurant)
3. For restaurant requests, match cuisine types to appropriate restaurant templates:
   - Asian cuisines (chinese, japanese, thai, vietnamese, ramen, sushi): Bamboo Bistro, The Red Noodle, Saigon Veranda
   - American/farm-to-table: Artisan Hearth v3, Bold Feast v2
   - European/fine dining: Classic Minimalist v2, Noir Luxe v3, Indochine Luxe
   - Fusion/contemporary: Dynamic Fusion, Chromatic Street, Gastrobotanical
   - Healthy/fresh: Fresh Market
4. For non-restaurant projects, recommend templates from the generic category
5. Follow the exact XML format
6. Consider both technical requirements, tags, and category
7. If no perfect match exists, recommend the closest option

Restaurant Keywords to detect:
restaurant, restaurant website, dining, food service, menu, eatery, café, cafe, bistro,
chinese restaurant, japanese restaurant, thai restaurant, vietnamese restaurant, ramen shop,
sushi bar, dim sum, pho, noodles, fusion restaurant, fine dining, gastropub,
food truck, street food, farmers market, botanical garden, farm-to-table

Important: Provide only the selection tags in your response, no additional text.
MOST IMPORTANT: YOU DONT HAVE TIME TO THINK JUST START RESPONDING BASED ON HUNCH 
`;

const templates: Template[] = STARTER_TEMPLATES.filter((t) => !t.name.includes('shadcn'));

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

    if (!templateNameMatch) {
      return null;
    }

    return { template: templateNameMatch[1].trim(), title: titleMatch?.[1].trim() || 'Untitled Project' };
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;

  logger.info(`[THEME DEBUG] selectStarterTemplate called with message: "${message.substring(0, 100)}..."`);
  logger.debug(`[THEME DEBUG] Model: ${model}, Provider: ${provider.name}`);

  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates),
  };
  const response = await fetch('/api/llmcall', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  const respJson: { text: string } = await response.json();
  logger.debug(`[THEME DEBUG] LLM response: ${JSON.stringify(respJson)}`);

  const { text } = respJson;
  const selectedTemplate = parseSelectedTemplate(text);

  if (selectedTemplate) {
    logger.info(`[THEME DEBUG] Template selected: "${selectedTemplate.template}", title: "${selectedTemplate.title}"`);
    return selectedTemplate;
  } else {
    logger.warn('[THEME DEBUG] No template selected, using blank template');

    return {
      template: 'blank',
      title: '',
    };
  }
};

/*
 * ============================================================================
 * Crawler-based Template Selection
 * ============================================================================
 */

/**
 * Build a rich context string from crawler data for template selection
 */
function buildCrawlerContextPrompt(crawlerOutput: CrawlerOutput, userDescription: string): string {
  const businessIntelligence = crawlerOutput.business_intelligence;
  const brandStrategy = crawlerOutput.brand_strategy;
  const visualAssetStrategy = crawlerOutput.visual_asset_strategy;
  const coreIdentity = businessIntelligence.core_identity;
  const industryContext = businessIntelligence.industry_context;
  const reputationSnapshot = businessIntelligence.reputation_snapshot;

  return `
Business Profile:
- Name: ${coreIdentity.brand_display_name}
- Category: ${industryContext.primary_category}
- Price Tier: ${industryContext.price_tier}
- Features: ${industryContext.operational_highlights.join(', ')}

Brand Strategy:
- Tone of Voice: ${brandStrategy.tone_of_voice}
- Target Audience: ${brandStrategy.target_audience_persona}
- Visual Style: ${brandStrategy.visual_style_prompt}
- Dark Mode Suitable: ${visualAssetStrategy.color_palette_extracted.is_dark_mode_suitable ? 'Yes' : 'No'}

User Description: ${userDescription}

Rating: ${reputationSnapshot.average_rating} stars (${reputationSnapshot.total_reviews} reviews)
`.trim();
}

/**
 * Restaurant-specific template selection prompt
 */
const crawlerTemplateSelectionPrompt = (templates: Template[]) => `
You are an expert restaurant brand consultant selecting the perfect website template.

Available Restaurant Templates:
${templates
  .filter((t) => t.category === 'restaurant')
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  <tags>${template.tags?.join(', ') || ''}</tags>
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{exact template name}</templateName>
  <reasoning>{brief explanation}</reasoning>
</selection>

Selection Guidelines:
1. Match cuisine type to template specialty:
   - Vietnamese/Pho: Saigon Veranda, Indochine Luxe
   - Chinese/Dim Sum/Ramen: Bamboo Bistro, The Red Noodle
   - Japanese/Sushi: Bamboo Bistro, Classic Minimalist v2
   - Italian/European: Artisan Hearth v3, Noir Luxe v3
   - American/Farm-to-table: Artisan Hearth v3, Bold Feast v2
   - Fine Dining/Luxury: Noir Luxe v3, Classic Minimalist v2, Indochine Luxe
   - Street Food/Casual: Chromatic Street, Fresh Market
   - Fusion/Contemporary: Dynamic Fusion, Gastrobotanical

2. Match style and ambiance:
   - Luxury/Premium → Noir Luxe v3, Indochine Luxe
   - Rustic/Warm → Artisan Hearth v3
   - Modern/Clean → Classic Minimalist v2, Bold Feast v2
   - Vibrant/Urban → Chromatic Street, Dynamic Fusion
   - Fresh/Healthy → Fresh Market, Gastrobotanical

3. Consider dark mode suitability:
   - Dark mode suitable → Noir Luxe v3, Bamboo Bistro, The Red Noodle
   - Light/bright preferred → Fresh Market, Artisan Hearth v3, Classic Minimalist v2

Important: Choose the BEST single match. Return only the selection tags.
`;

/**
 * Select the best restaurant template based on crawler data
 * This uses LLM to intelligently match business profile to template
 */
export async function selectTemplateFromCrawlerData(options: {
  crawlerOutput: CrawlerOutput;
  userDescription: string;
  model: string;
  provider: ProviderInfo;
}): Promise<{ template: string; title: string; reasoning?: string }> {
  const { crawlerOutput, userDescription, model, provider } = options;

  logger.info('[CRAWLER TEMPLATE] Selecting template from crawler data');
  logger.debug(
    '[CRAWLER TEMPLATE] Business category:',
    crawlerOutput.business_intelligence.industry_context.primary_category,
  );

  const contextPrompt = buildCrawlerContextPrompt(crawlerOutput, userDescription);

  const requestBody = {
    message: contextPrompt,
    model,
    provider,
    system: crawlerTemplateSelectionPrompt(templates),
  };

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const respJson: { text: string } = await response.json();
    logger.debug('[CRAWLER TEMPLATE] LLM response:', respJson.text);

    // Parse the response
    const templateMatch = respJson.text.match(/<templateName>(.*?)<\/templateName>/);
    const reasoningMatch = respJson.text.match(/<reasoning>(.*?)<\/reasoning>/s);

    if (templateMatch) {
      const selectedTemplate = templateMatch[1].trim();
      const reasoning = reasoningMatch?.[1].trim();

      logger.info(`[CRAWLER TEMPLATE] Selected: "${selectedTemplate}"`);

      return {
        template: selectedTemplate,
        title: `${crawlerOutput.business_intelligence.core_identity.brand_display_name} Website`,
        reasoning,
      };
    }
  } catch (error) {
    logger.error('[CRAWLER TEMPLATE] LLM selection failed:', error);
  }

  // Fallback: Use deterministic selection based on cuisine keywords
  return selectTemplateFromCrawlerDataFallback(crawlerOutput, userDescription);
}

/**
 * Fallback deterministic template selection when LLM is unavailable
 */
function selectTemplateFromCrawlerDataFallback(
  crawlerOutput: CrawlerOutput,
  userDescription: string,
): { template: string; title: string; reasoning: string } {
  const category = crawlerOutput.business_intelligence.industry_context.primary_category.toLowerCase();
  const priceTier = crawlerOutput.business_intelligence.industry_context.price_tier;
  const isDarkMode = crawlerOutput.visual_asset_strategy.color_palette_extracted.is_dark_mode_suitable;

  logger.info('[CRAWLER TEMPLATE FALLBACK] Using deterministic selection');

  // Map category keywords to templates
  const categoryMappings: Record<string, string> = {
    vietnamese: 'Saigon Veranda',
    chinese: 'Bamboo Bistro',
    japanese: 'Bamboo Bistro',
    thai: 'Bamboo Bistro',
    asian: 'Bamboo Bistro',
    italian: 'Artisan Hearth v3',
    american: 'Bold Feast v2',
    'farm-to-table': 'Artisan Hearth v3',
    'fine dining': 'Noir Luxe v3',
    fusion: 'Dynamic Fusion',
    'street food': 'Chromatic Street',
    café: 'Fresh Market',
    cafe: 'Fresh Market',
    seafood: 'Classic Minimalist v2',
  };

  // Find matching category
  let selectedTemplate = 'Artisan Hearth v3'; // Default

  for (const [keyword, template] of Object.entries(categoryMappings)) {
    if (category.includes(keyword) || userDescription.toLowerCase().includes(keyword)) {
      selectedTemplate = template;
      break;
    }
  }

  // Override for luxury/premium
  if (priceTier === 'Luxury' || priceTier === 'Premium') {
    if (isDarkMode) {
      selectedTemplate = 'Noir Luxe v3';
    } else {
      selectedTemplate = 'Classic Minimalist v2';
    }
  }

  logger.info(`[CRAWLER TEMPLATE FALLBACK] Selected: "${selectedTemplate}"`);

  return {
    template: selectedTemplate,
    title: `${crawlerOutput.business_intelligence.core_identity.brand_display_name} Website`,
    reasoning: `Fallback selection based on category: ${category}, price tier: ${priceTier}`,
  };
}

/*
 * ============================================================================
 * GitHub Template Content
 * ============================================================================
 */

const getGitHubRepoContent = async (repoName: string): Promise<{ name: string; path: string; content: string }[]> => {
  try {
    logger.info(`[THEME DEBUG] Fetching GitHub repo content for: ${repoName}`);

    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`);

    if (!response.ok) {
      logger.error(`[THEME DEBUG] GitHub API error! status: ${response.status} for repo: ${repoName}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Our API will return the files in the format we need
    const files = (await response.json()) as any;
    logger.info(`[THEME DEBUG] Successfully fetched ${files.length} files from GitHub repo: ${repoName}`);

    return files;
  } catch (error) {
    logger.error(`[THEME DEBUG] Error fetching release contents for ${repoName}:`, error);
    throw error;
  }
};

export async function getTemplates(templateName: string, title?: string) {
  logger.info(`[THEME DEBUG] getTemplates called with templateName: "${templateName}", title: "${title || 'N/A'}"`);

  const template = STARTER_TEMPLATES.find((t) => t.name == templateName);

  if (!template) {
    logger.warn(`[THEME DEBUG] Template not found: "${templateName}"`);
    return null;
  }

  logger.info(
    `[THEME DEBUG] Template found: "${template.name}", category: "${template.category || 'N/A'}", restaurantThemeId: "${template.restaurantThemeId || 'N/A'}"`,
  );
  logger.debug(
    `[THEME DEBUG] Template details: ${JSON.stringify({ name: template.name, githubRepo: template.githubRepo, category: template.category, restaurantThemeId: template.restaurantThemeId })}`,
  );

  const githubRepo = template.githubRepo;
  logger.info(`[THEME DEBUG] Fetching files from GitHub repo: ${githubRepo}`);

  const files = await getGitHubRepoContent(githubRepo);

  let filteredFiles = files;
  logger.debug(`[THEME DEBUG] Starting file filtering. Total files: ${files.length}`);

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  /*
   * exclude    lock files
   * WE NOW INCLUDE LOCK FILES FOR IMPROVED INSTALL TIMES
   */
  {
    /*
     *const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
     *filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);
     */
  }

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);
  logger.debug(`[THEME DEBUG] After filtering .git and .bolt: ${filteredFiles.length} files`);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  if (templateIgnoreFile) {
    logger.debug(`[THEME DEBUG] Found template ignore file: ${templateIgnoreFile.path}`);
  }

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  logger.info(`[THEME DEBUG] Constructing assistant message with ${filesToImport.files.length} files to import`);
  logger.debug(`[THEME DEBUG] Ignored files count: ${filesToImport.ignoreFile.length}`);

  const assistantMessage = `
Bolt is initializing your project with the required files using the ${template.name} template.
<boltArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
  let userMessage = ``;

  // For restaurant templates, use local theme prompts from registry
  let themePromptContent: string | null = null;

  if (template.restaurantThemeId) {
    themePromptContent = getThemePrompt(template.restaurantThemeId);

    if (themePromptContent) {
      logger.debug(`[THEME DEBUG] Using local theme prompt for: ${template.restaurantThemeId}`);
    } else {
      logger.warn(`[THEME DEBUG] No local theme prompt found for restaurantThemeId: ${template.restaurantThemeId}`);
    }
  }

  // Fall back to .bolt/prompt for non-restaurant templates
  const templatePromptFile = !themePromptContent
    ? files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt')
    : null;

  if (templatePromptFile) {
    logger.debug(`[THEME DEBUG] Found template prompt file: ${templatePromptFile.path}`);
  } else if (!themePromptContent) {
    logger.debug(`[THEME DEBUG] No template prompt file found`);
  }

  if (themePromptContent) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${themePromptContent}

---
`;
  } else if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
  }

  userMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request

IMPORTANT: Dont Forget to install the dependencies before running the app by using \`npm install && npm run dev\`
`;

  logger.info(
    `[THEME DEBUG] getTemplates completed successfully. Assistant message length: ${assistantMessage.length}, User message length: ${userMessage.length}`,
  );

  return {
    assistantMessage,
    userMessage,
  };
}

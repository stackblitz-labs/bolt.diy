/**
 * Template priming message builder.
 *
 * Builds LLM messages that prime the conversation with template files
 * so the LLM customizes existing code instead of generating from scratch.
 */

import type { BusinessProfile } from '~/types/project';
import type { TemplateFile } from './github-template-fetcher';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('template-primer');

/**
 * Result of building template priming messages.
 */
export interface TemplatePrimingMessages {
  /** Assistant message containing the template files as a boltArtifact */
  assistantMessage: string;

  /** User message instructing LLM to customize the template */
  userMessage: string;
}

/**
 * Builds the assistant message containing all template files.
 *
 * This follows the pattern from selectStarterTemplate.ts::getTemplates()
 * where template files are wrapped in a <boltArtifact> block.
 *
 * @param files - Template files to include
 * @param templateName - Name of the template for display
 * @param title - Project title
 * @returns Formatted assistant message
 */
export function buildTemplateFilesMessage(files: TemplateFile[], templateName: string, title: string): string {
  logger.debug(`[TEMPLATE_PRIMER] Building assistant message with ${files.length} files`);

  return `
Bolt is initializing your project with the required files using the ${templateName} template.
<boltArtifact id="imported-files" title="${title}" type="bundled">
${files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`.trim();
}

/**
 * Builds the user message that instructs the LLM to customize the template.
 *
 * This message tells the LLM to modify the existing template files with
 * business data rather than generating new code from scratch.
 *
 * @param businessProfile - Business profile with data to inject
 * @param themePrompt - Theme-specific customization instructions
 * @param ignoredFiles - Files that should be read-only
 * @param templateName - Name of the template
 * @returns Formatted user message
 */
export function buildCustomizationMessage(
  businessProfile: BusinessProfile,
  themePrompt: string,
  ignoredFiles: TemplateFile[],
  templateName: string,
): string {
  const businessName =
    businessProfile.generated_content?.businessIdentity?.displayName ||
    businessProfile.crawled_data?.name ||
    'Restaurant';

  logger.debug(`[TEMPLATE_PRIMER] Building customization message for "${businessName}"`);

  const parts: string[] = [];

  // Theme instructions
  if (themePrompt) {
    parts.push(`TEMPLATE INSTRUCTIONS:
${themePrompt}

---`);
  }

  // Read-only file rules
  if (ignoredFiles.length > 0) {
    parts.push(`STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${ignoredFiles.map((file) => `- ${file.path}`).join('\n')}

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
---`);
  }

  // Business profile data
  const profileData = formatBusinessProfileForCustomization(businessProfile);

  parts.push(`BUSINESS DATA TO INJECT:
${profileData}

---`);

  // Customization instructions
  parts.push(`CUSTOMIZATION TASK:

The ${templateName} template has been imported above. Your task is to CUSTOMIZE this existing template for "${businessName}".

CRITICAL INSTRUCTIONS:
1. DO NOT generate new boilerplate code - the template already has the complete structure
2. MODIFY existing files to inject the business data provided above
3. Replace ALL placeholder text with actual business information:
   - Update the restaurant name in headers, footers, and meta tags
   - Update contact information (address, phone, hours)
   - Customize the hero section with business-specific copy
   - Update the About section with business story/description
   - Populate the Menu section with actual menu items if provided
   - Update the Contact section with real contact details

4. PRESERVE the template's design patterns, component structure, and styling
5. Focus on content customization, not structural changes
6. Generate ONLY the files that need modifications - do not regenerate unchanged files

Begin customizing the template now.`);

  // Format reminder - CRITICAL for parser compatibility - positioned LAST for recency effect
  parts.push(`## OUTPUT FORMAT - FINAL REMINDER

You are a code generator, NOT an assistant with function calls.

Every file you create MUST use this exact format:

<boltArtifact id="customize-template" title="Customize Template">
  <boltAction type="file" filePath="src/data/content.ts">
export const siteContent = {
  seo: { title: "...", description: "..." },
  // etc.
};
  </boltAction>
</boltArtifact>

CRITICAL - If you output any of these formats, the file will NOT be created:
- <function_calls> - WILL BE IGNORED
- <invoke> - WILL BE IGNORED
- <parameter> - WILL BE IGNORED
- bash heredoc (cat > file << EOF) - WILL BE IGNORED

Only <boltArtifact> and <boltAction> tags are parsed. Use them now.`);

  return parts.join('\n\n');
}

/**
 * Main entry point: builds both assistant and user messages for template priming.
 *
 * @param includedFiles - Template files to show in the assistant message
 * @param ignoredFiles - Read-only files to reference
 * @param businessProfile - Business data for customization
 * @param templateName - Name of the template
 * @param themePrompt - Theme-specific instructions
 * @param title - Project title
 * @returns Both messages ready to use with streamText
 */
export function buildTemplatePrimingMessages(
  includedFiles: TemplateFile[],
  ignoredFiles: TemplateFile[],
  businessProfile: BusinessProfile,
  templateName: string,
  themePrompt: string,
  title: string = 'Restaurant Website',
): TemplatePrimingMessages {
  logger.info(`[TEMPLATE_PRIMER] Building priming messages for template: ${templateName}`);
  logger.info(`[TEMPLATE_PRIMER] Included files: ${includedFiles.length}, Ignored files: ${ignoredFiles.length}`);

  /*
   * Include ALL files in the artifact so they're written to the file system
   * Ignored files are still marked as read-only in the user message
   */
  const allFilesForArtifact = [...includedFiles, ...ignoredFiles];

  const assistantMessage = buildTemplateFilesMessage(allFilesForArtifact, templateName, title);
  const userMessage = buildCustomizationMessage(businessProfile, themePrompt, ignoredFiles, templateName);

  logger.info(`[TEMPLATE_PRIMER] Assistant message length: ${assistantMessage.length}`);
  logger.info(`[TEMPLATE_PRIMER] User message length: ${userMessage.length}`);

  return {
    assistantMessage,
    userMessage,
  };
}

/**
 * Formats business profile data for injection into the customization message.
 */
function formatBusinessProfileForCustomization(profile: BusinessProfile): string {
  const crawled = profile.crawled_data;
  const generated = profile.generated_content;

  const displayName = generated?.businessIdentity?.displayName || crawled?.name || 'Restaurant Name';
  const tagline = generated?.businessIdentity?.tagline || '';
  const description = generated?.businessIdentity?.description || '';

  const address = crawled?.address || '';
  const phone = crawled?.phone || '';
  const website = crawled?.website || generated?.extractedData?.websiteUrl || '';

  // Format hours
  const hoursLines = crawled?.hours
    ? Object.entries(crawled.hours)
        .slice(0, 7)
        .map(([day, value]) => `  ${day}: ${value}`)
        .join('\n')
    : '  Contact for hours';

  // Format menu categories
  const menuLines = crawled?.menu?.categories
    ?.slice(0, 6)
    .map((category) => {
      const items = category.items
        .slice(0, 6)
        .map((item) => {
          const price = item.price ? ` ($${item.price})` : '';
          return `    - ${item.name}${price}`;
        })
        .join('\n');
      return `  ${category.name}:\n${items}`;
    })
    .join('\n');

  // Format reviews
  const reviewLines = crawled?.reviews
    ?.filter((r) => r.text?.trim())
    ?.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    ?.slice(0, 3)
    ?.map((r) => {
      const author = r.author ? ` — ${r.author}` : '';
      const rating = typeof r.rating === 'number' ? ` (${r.rating}★)` : '';

      return `  "${r.text?.trim()}"${author}${rating}`;
    })
    .join('\n');

  // Brand strategy
  const tone = generated?.brandStrategy?.toneOfVoice || '';
  const usp = generated?.brandStrategy?.usp || '';
  const targetAudience = generated?.brandStrategy?.targetAudience || '';

  // Color palette
  const palette = generated?.visualAssets?.colorPalette;
  const paletteLines = palette
    ? [
        palette.primary ? `  Primary: ${palette.primary}` : null,
        palette.secondary ? `  Secondary: ${palette.secondary}` : null,
        palette.accent ? `  Accent: ${palette.accent}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return [
    `Business Name: ${displayName}`,
    tagline ? `Tagline: ${tagline}` : null,
    description ? `Description: ${description}` : null,
    '',
    'Contact Information:',
    address ? `  Address: ${address}` : '  Address: (not provided)',
    phone ? `  Phone: ${phone}` : '  Phone: (not provided)',
    website ? `  Website: ${website}` : null,
    '',
    'Hours of Operation:',
    hoursLines,
    '',
    menuLines ? 'Menu:\n' + menuLines : 'Menu: (not provided)',
    '',
    reviewLines ? 'Top Reviews:\n' + reviewLines : '',
    '',
    tone ? `Brand Tone: ${tone}` : null,
    usp ? `Unique Selling Point: ${usp}` : null,
    targetAudience ? `Target Audience: ${targetAudience}` : null,
    '',
    paletteLines ? 'Color Palette:\n' + paletteLines : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
    .trim();
}

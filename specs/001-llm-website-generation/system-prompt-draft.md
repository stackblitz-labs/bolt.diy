# System Prompt Draft: Website Generation from Business Profile

This document contains the draft system prompt to be used when generating a website from a business profile during the "Building your website" phase.

## Prompt Structure

The complete prompt sent to the LLM will be composed of three parts:

1. **Base System Prompt** - Existing Bolt system prompt with WebContainer constraints
2. **Theme-Specific Instructions** - Design guidelines from selected restaurant theme
3. **Business Content Injection** - Formatted business profile data

---

## Part 1: Website Generation Context (Prepended to Base System Prompt)

```
You are generating a complete, production-ready restaurant website based on the business profile provided below. Your task is to:

1. Create a beautiful, mobile-responsive single-page website
2. Inject all business information into appropriate sections
3. Follow the design theme instructions provided
4. Ensure all placeholder content is replaced with actual business data

CRITICAL RULES:
- NEVER use placeholder text like "Lorem ipsum" or "[Business Name]"
- ALWAYS use the actual business data provided below
- Generate complete, working code that can be previewed immediately
- Include proper meta tags for SEO with the business name and description
- Ensure the website is accessible and follows WCAG guidelines
```

---

## Part 2: Business Profile Data Template

```
<business_profile>
  <identity>
    <name>{business_name}</name>
    <tagline>{tagline_or_generated}</tagline>
    <description>{about_description}</description>
    <category>{primary_category}</category>
  </identity>
  
  <contact>
    <address>{full_address}</address>
    <phone>{phone_number}</phone>
    <website>{existing_website_url}</website>
    <booking_url>{booking_action_url}</booking_url>
  </contact>
  
  <hours>
    {operating_hours_formatted}
  </hours>
  
  <reputation>
    <rating>{average_rating}</rating>
    <reviews_count>{total_reviews}</reviews_count>
    <trust_badge>{trust_badge_text}</trust_badge>
  </reputation>
  
  <brand>
    <usp>{inferred_usp}</usp>
    <target_audience>{target_audience_persona}</target_audience>
    <tone>{tone_of_voice}</tone>
    <style>{visual_style_prompt}</style>
  </brand>
  
  <colors>
    <primary>{primary_hex}</primary>
    <accent>{accent_hex}</accent>
  </colors>
  
  <social>
    <facebook>{facebook_url}</facebook>
    <instagram>{instagram_url}</instagram>
    <whatsapp>{whatsapp_number}</whatsapp>
  </social>
</business_profile>
```

---

## Part 3: Generation Instructions

```
WEBSITE SECTIONS TO GENERATE:

1. **Hero Section**
   - Business name prominently displayed
   - Tagline or unique selling proposition
   - Call-to-action button (reservation/order/contact)
   - Hero image placeholder with appropriate styling

2. **About Section**
   - Business description/story
   - What makes this business unique
   - Target audience appeal

3. **Menu/Services Section** (if applicable)
   - Feature highlights based on category
   - Operational highlights from profile
   - Price tier indication

4. **Contact & Location Section**
   - Full address with map embed placeholder
   - Phone number (clickable for mobile)
   - Operating hours displayed clearly
   - Social media links

5. **Reviews/Testimonials Section**
   - Display rating and review count
   - Trust badge text
   - Social proof elements

6. **Footer**
   - Business name
   - Quick contact info
   - Social links
   - Copyright notice

TECHNICAL REQUIREMENTS:
- Use Vite + React for the project structure
- Implement responsive design (mobile-first)
- Use CSS variables for theme colors from business profile
- Include smooth scroll navigation
- Add hover states and micro-interactions
- Ensure all images use lazy loading

OUTPUT FORMAT:
Generate a complete <boltArtifact> with all necessary files:
- package.json with dependencies
- index.html
- src/main.tsx
- src/App.tsx
- src/components/ (Hero, About, Menu, Contact, Footer)
- src/styles/
- src/data/content.ts (business data)
```

---

## Part 4: Theme-Specific Instructions (Example)

```
DESIGN THEME: {selected_theme_name}

{theme_prompt_content}

Apply these design principles while maintaining the business's actual branding colors:
- Primary color: {primary_hex}
- Accent color: {accent_hex}
```

---

## Complete Prompt Assembly

The final prompt sent to the LLM will be assembled as:

```typescript
const systemPrompt = `
${websiteGenerationContext}

${baseSystemPrompt}

${themeInstructions}
`;

const userMessage = `
Generate a website for the following business:

${businessProfileXml}

${generationInstructions}
`;
```

---

## Data Mapping from BusinessProfile

| Prompt Field | Source in BusinessProfile |
|--------------|--------------------------|
| business_name | crawled_data.name |
| tagline | generated_content.businessIdentity.tagline |
| about_description | generated_content.businessIdentity.description |
| primary_category | generated_content.industryContext.categories[0] |
| full_address | crawled_data.address |
| phone_number | crawled_data.phone |
| operating_hours | crawled_data.hours |
| average_rating | crawled_data.rating |
| total_reviews | crawled_data.reviews_count |
| primary_hex | generated_content.visualAssets.colorPalette.primary |
| accent_hex | generated_content.visualAssets.colorPalette.accent |

---

## Fallback Values for Missing Data

When business profile data is incomplete:

| Field | Fallback Value |
|-------|----------------|
| tagline | "Welcome to {business_name}" |
| description | "Experience quality and service at {business_name}" |
| phone | (omit section if not provided) |
| hours | "Contact us for hours" |
| rating | (omit reviews section if not provided) |
| colors | Use theme default colors |

---

## Implementation Notes

1. **Token Optimization**: The prompt should be structured to maximize useful output while minimizing redundant instructions

2. **Streaming**: Support streaming responses to show real-time generation progress

3. **Validation**: Generated code should be validated before injection into WebContainer

4. **Error Recovery**: If generation fails mid-stream, provide meaningful error messages

5. **Caching**: Consider caching theme prompts to reduce prompt assembly time

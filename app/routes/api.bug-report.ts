import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Input validation schema
const bugReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be 2000 characters or less'),
  stepsToReproduce: z.string().max(1000, 'Steps to reproduce must be 1000 characters or less').optional(),
  expectedBehavior: z.string().max(1000, 'Expected behavior must be 1000 characters or less').optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  includeEnvironmentInfo: z.boolean().default(false),
  environmentInfo: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      screenResolution: z.string().optional(),
      boltVersion: z.string().optional(),
      aiProviders: z.string().optional(),
      projectType: z.string().optional(),
      currentModel: z.string().optional(),
    })
    .optional(),
});

// Sanitize input to prevent XSS
function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Rate limiting check
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    // Reset window (1 hour)
    rateLimitStore.set(key, { count: 1, resetTime: now + 60 * 60 * 1000 });
    return true;
  }

  if (limit.count >= 5) {
    // Max 5 reports per hour per IP
    return false;
  }

  limit.count += 1;
  rateLimitStore.set(key, limit);

  return true;
}

// Get client IP address
function getClientIP(request: Request): string {
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');

  return cfConnectingIP || xForwardedFor?.split(',')[0] || xRealIP || 'unknown';
}

// Basic spam detection
function isSpam(title: string, description: string): boolean {
  const spamPatterns = [
    /\b(viagra|casino|poker|loan|debt|credit)\b/i,
    /\b(click here|buy now|limited time)\b/i,
    /\b(make money|work from home|earn \$\$)\b/i,
  ];

  const content = title + ' ' + description;

  return spamPatterns.some((pattern) => pattern.test(content));
}

// Format GitHub issue body
function formatIssueBody(data: z.infer<typeof bugReportSchema>): string {
  let body = '**Bug Report** (User Submitted)\n\n';

  body += `**Description:**\n${data.description}\n\n`;

  if (data.stepsToReproduce) {
    body += `**Steps to Reproduce:**\n${data.stepsToReproduce}\n\n`;
  }

  if (data.expectedBehavior) {
    body += `**Expected Behavior:**\n${data.expectedBehavior}\n\n`;
  }

  if (data.includeEnvironmentInfo && data.environmentInfo) {
    body += `**Environment Info:**\n`;

    if (data.environmentInfo.browser) {
      body += `- Browser: ${data.environmentInfo.browser}\n`;
    }

    if (data.environmentInfo.os) {
      body += `- OS: ${data.environmentInfo.os}\n`;
    }

    if (data.environmentInfo.screenResolution) {
      body += `- Screen: ${data.environmentInfo.screenResolution}\n`;
    }

    if (data.environmentInfo.boltVersion) {
      body += `- bolt.diy: ${data.environmentInfo.boltVersion}\n`;
    }

    if (data.environmentInfo.aiProviders) {
      body += `- AI Providers: ${data.environmentInfo.aiProviders}\n`;
    }

    if (data.environmentInfo.projectType) {
      body += `- Project Type: ${data.environmentInfo.projectType}\n`;
    }

    if (data.environmentInfo.currentModel) {
      body += `- Current Model: ${data.environmentInfo.currentModel}\n`;
    }

    body += '\n';
  }

  if (data.contactEmail) {
    body += `**Contact:** ${data.contactEmail}\n\n`;
  }

  body += '---\n*Submitted via bolt.diy bug report feature*';

  return body;
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(request);

    if (!checkRateLimit(clientIP)) {
      return json({ error: 'Rate limit exceeded. Please wait before submitting another report.' }, { status: 429 });
    }

    // Parse and validate request body
    const formData = await request.formData();
    const rawData: any = Object.fromEntries(formData.entries());

    // Parse environment info if provided
    if (rawData.environmentInfo && typeof rawData.environmentInfo === 'string') {
      try {
        rawData.environmentInfo = JSON.parse(rawData.environmentInfo);
      } catch {
        rawData.environmentInfo = undefined;
      }
    }

    // Convert boolean fields
    rawData.includeEnvironmentInfo = rawData.includeEnvironmentInfo === 'true';

    const validatedData = bugReportSchema.parse(rawData);

    // Sanitize text inputs
    const sanitizedData = {
      ...validatedData,
      title: sanitizeInput(validatedData.title),
      description: sanitizeInput(validatedData.description),
      stepsToReproduce: validatedData.stepsToReproduce ? sanitizeInput(validatedData.stepsToReproduce) : undefined,
      expectedBehavior: validatedData.expectedBehavior ? sanitizeInput(validatedData.expectedBehavior) : undefined,
    };

    // Spam detection
    if (isSpam(sanitizedData.title, sanitizedData.description)) {
      return json(
        { error: 'Your report was flagged as potential spam. Please contact support if this is an error.' },
        { status: 400 },
      );
    }

    // Get GitHub configuration
    const githubToken =
      (context?.cloudflare?.env as any)?.GITHUB_BUG_REPORT_TOKEN || process.env.GITHUB_BUG_REPORT_TOKEN;
    const targetRepo =
      (context?.cloudflare?.env as any)?.BUG_REPORT_REPO || process.env.BUG_REPORT_REPO || 'stackblitz-labs/bolt.diy';

    if (!githubToken) {
      console.error('GitHub bug report token not configured');
      return json(
        { error: 'Bug reporting is not properly configured. Please contact the administrators.' },
        { status: 500 },
      );
    }

    // Initialize GitHub client
    const octokit = new Octokit({
      auth: githubToken,
      userAgent: 'bolt.diy-bug-reporter',
    });

    // Create GitHub issue
    const [owner, repo] = targetRepo.split('/');
    const issue = await octokit.rest.issues.create({
      owner,
      repo,
      title: sanitizedData.title,
      body: formatIssueBody(sanitizedData),
      labels: ['bug', 'user-reported'],
    });

    return json({
      success: true,
      issueNumber: issue.data.number,
      issueUrl: issue.data.html_url,
      message: 'Bug report submitted successfully!',
    });
  } catch (error) {
    console.error('Error creating bug report:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }

    // Handle GitHub API errors
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 401) {
        return json({ error: 'GitHub authentication failed. Please contact administrators.' }, { status: 500 });
      }

      if (error.status === 403) {
        return json({ error: 'GitHub rate limit reached. Please try again later.' }, { status: 503 });
      }

      if (error.status === 404) {
        return json({ error: 'Target repository not found. Please contact administrators.' }, { status: 500 });
      }
    }

    return json({ error: 'Failed to submit bug report. Please try again later.' }, { status: 500 });
  }
}

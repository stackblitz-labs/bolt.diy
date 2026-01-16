import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { requireSessionOrError } from '~/lib/auth/guards.server';
import { getProjectById } from '~/lib/services/projects.server';
import type { GenerationErrorCode, GenerationRequest, GenerationSSEEvent } from '~/types/generation';
import type { BusinessProfile } from '~/types/project';
import { createScopedLogger } from '~/utils/logger';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { generateProjectWebsite, validateBusinessProfile } from '~/lib/services/projectGenerationService';

const logger = createScopedLogger('api.project.generate');

type GenerateWebsiteRequestBody = GenerationRequest & {
  model?: string;
  provider?: string;
};

function jsonError(status: number, code: GenerationErrorCode, message: string) {
  return json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  logger.warn('GET /api/project/generate not supported', { url: request.url });

  return json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Method Not Allowed. Use POST /api/project/generate with JSON body { projectId }.',
      },
    },
    {
      status: 405,
      headers: {
        Allow: 'POST',
      },
    },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = await requireSessionOrError(request);
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return jsonError(401, 'INTERNAL_ERROR', 'Unauthorized');
  }

  let body: GenerateWebsiteRequestBody;

  try {
    body = await request.json<GenerateWebsiteRequestBody>();
  } catch (error) {
    logger.warn('Invalid JSON body', { error: error instanceof Error ? error.message : String(error) });
    return jsonError(400, 'INTERNAL_ERROR', 'Invalid JSON body');
  }

  if (!body?.projectId || typeof body.projectId !== 'string') {
    return jsonError(400, 'INTERNAL_ERROR', 'Missing projectId');
  }

  const project = await getProjectById(body.projectId, userId);

  if (!project) {
    return jsonError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  const businessProfile = project.business_profile ?? null;

  // Enrich business profile with project data as fallback
  const enrichedProfile: BusinessProfile = businessProfile
    ? {
        ...businessProfile,
        crawled_data: {
          ...(businessProfile.crawled_data || {}),

          // Use project.name if crawled_data.name is missing
          name: businessProfile.crawled_data?.name || project.name,
        },
      }
    : {
        // Create minimal profile from project data
        session_id: crypto.randomUUID(),
        crawled_data: {
          name: project.name,
        },
        crawled_at: new Date().toISOString(),
      };

  logger.info('Business profile enrichment', {
    projectId: project.id,
    hadProfile: !!businessProfile,
    hadCrawledData: !!businessProfile?.crawled_data,
    hadName: !!businessProfile?.crawled_data?.name,
    usedProjectName: !businessProfile?.crawled_data?.name,
  });

  const validation = validateBusinessProfile(enrichedProfile);

  if (!validation.valid) {
    return jsonError(400, 'NO_BUSINESS_PROFILE', validation.errors[0] ?? 'No business profile data');
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  const resolvedProviderName = body.provider ?? DEFAULT_PROVIDER?.name ?? PROVIDER_LIST[0]?.name ?? 'unknown';
  const resolvedModel = body.model ?? DEFAULT_MODEL;

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: GenerationSSEEvent) => {
        const message = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Heartbeat to keep the connection alive on long generations
      const heartbeat = setInterval(() => {
        send({ event: 'heartbeat', data: { timestamp: Date.now() } });
      }, 5000);

      try {
        for await (const event of generateProjectWebsite(body.projectId, userId, {
          model: resolvedModel,
          provider: { name: resolvedProviderName, staticModels: [] },
          baseUrl,
          cookieHeader,
          env: context.cloudflare?.env as any,
          apiKeys,
          providerSettings,
          businessProfile: enrichedProfile,
        })) {
          send(event);
        }
      } catch (error) {
        logger.error('Generation stream failed', {
          error: error instanceof Error ? error.message : String(error),
          projectId: body.projectId,
        });

        send({
          event: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Generation failed',
            code: 'INTERNAL_ERROR',
            retryable: true,
          },
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

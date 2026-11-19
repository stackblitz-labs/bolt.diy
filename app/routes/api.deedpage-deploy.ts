import type { ActionFunctionArgs } from 'react-router';
import { DEEDPAGE_API_URL, DEEDPAGE_MAX_BODY_BYTES, isValidDeedPageSlug, type DeedPageFile } from '~/lib/deedpage';

interface DeedPageDeployRequest {
  slug?: string;
  files?: Record<string, DeedPageFile>;
  token?: string;
}

interface DeedPagePublishResponse {
  ok?: boolean;
  url?: string;
  slug?: string;
  version?: string;
  token?: string;
  message?: string;
  message_for_user?: string;
  code?: string;
  error?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  let body: DeedPageDeployRequest;

  try {
    body = (await request.json()) as DeedPageDeployRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { slug, files, token } = body;

  if (!slug || !isValidDeedPageSlug(slug)) {
    return Response.json({ error: 'Invalid site name' }, { status: 400 });
  }

  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) {
    return Response.json({ error: 'No files to deploy' }, { status: 400 });
  }

  const payload = JSON.stringify({ slug, files });

  if (new TextEncoder().encode(payload).length > DEEDPAGE_MAX_BODY_BYTES) {
    return Response.json({ error: 'The build is larger than the 4 MB deed.page upload limit' }, { status: 413 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'bolt.diy',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${DEEDPAGE_API_URL}/v1/sites?ref=partner_bolt-diy`, {
      method: 'POST',
      headers,
      body: payload,
    });

    const text = await response.text();

    let data: DeedPagePublishResponse = {};

    try {
      data = text ? (JSON.parse(text) as DeedPagePublishResponse) : {};
    } catch {
      data = { message: text.slice(0, 300) };
    }

    if (!response.ok || data.ok === false || !data.url) {
      const error = data.message_for_user || data.message || data.error || `deed.page returned ${response.status}`;
      return Response.json({ error, code: data.code }, { status: response.ok ? 502 : response.status });
    }

    return Response.json({
      url: data.url,
      slug: data.slug ?? slug,
      version: data.version,

      // Only present on the first publish. The client keeps it to update this site later.
      token: data.token,
    });
  } catch (error) {
    console.error('deed.page deploy error:', error);
    return Response.json({ error: 'Could not reach deed.page' }, { status: 502 });
  }
}

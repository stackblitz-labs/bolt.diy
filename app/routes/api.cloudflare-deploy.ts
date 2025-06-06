import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import JSZip from 'jszip';

interface DeployRequestBody {
  accountId: string;
  projectName?: string;
  files: Record<string, string>;
  chatId: string;
  token: string;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { accountId, projectName, files, token, chatId } = (await request.json()) as DeployRequestBody;

    if (!accountId || !token) {
      return json({ error: 'Missing Cloudflare credentials' }, { status: 401 });
    }

    let targetProject = projectName;

    if (!targetProject) {
      const name = `bolt-diy-${chatId}-${Date.now()}`;
      const createRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!createRes.ok) {
        const txt = await createRes.text();
        return json({ error: `Failed to create project: ${txt}` }, { status: 400 });
      }

      targetProject = name;
    }

    const zip = new JSZip();

    for (const [filePath, content] of Object.entries(files)) {
      const normalized = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      zip.file(normalized, content);
    }

    const zipData = await zip.generateAsync({ type: 'nodebuffer' });

    const form = new FormData();
    form.append('metadata', JSON.stringify({}));
    form.append('file', new Blob([zipData]), 'deploy.zip');

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${targetProject}/deployments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form as any,
      },
    );

    interface DeployApiResponse {
      result: { id: string; url: string; project_id: string };
      errors?: { message: string }[];
    }

    const deployData = (await deployRes.json()) as DeployApiResponse;

    if (!deployRes.ok) {
      return json({ error: deployData.errors?.[0]?.message || 'Failed to deploy' }, { status: 400 });
    }

    return json({
      success: true,
      deploy: { id: deployData.result.id, url: deployData.result.url },
      project: { name: targetProject, id: deployData.result.project_id },
    });
  } catch (error) {
    console.error('Cloudflare deploy error:', error);
    return json({ error: 'Deployment failed' }, { status: 500 });
  }
}

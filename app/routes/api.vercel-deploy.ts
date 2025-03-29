import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import type { VercelProjectInfo } from '~/types/vercel';

// Add loader function to handle GET requests
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const token = url.searchParams.get('token');

  if (!projectId || !token) {
    return json({ error: 'Missing projectId or token' }, { status: 400 });
  }

  try {
    // Get project info
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!projectResponse.ok) {
      return json({ error: 'Failed to fetch project' }, { status: 400 });
    }

    const projectData = (await projectResponse.json()) as any;

    // Get latest deployment
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!deploymentsResponse.ok) {
      return json({ error: 'Failed to fetch deployments' }, { status: 400 });
    }

    const deploymentsData = (await deploymentsResponse.json()) as any;

    const latestDeployment = deploymentsData.deployments?.[0];

    return json({
      project: {
        id: projectData.id,
        name: projectData.name,
        url: `https://${projectData.name}.vercel.app`,
      },
      deploy: latestDeployment
        ? {
            id: latestDeployment.id,
            state: latestDeployment.state,
            url: latestDeployment.url ? `https://${latestDeployment.url}` : `https://${projectData.name}.vercel.app`,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching Vercel deployment:', error);
    return json({ error: 'Failed to fetch deployment' }, { status: 500 });
  }
}

interface DeployRequestBody {
  projectId?: string;
  files: Record<string, string>;
  chatId: string;
}

// Existing action function for POST requests
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { projectId, files, token, chatId } = (await request.json()) as DeployRequestBody & { token: string };

    if (!token) {
      return json({ error: 'Not connected to Vercel' }, { status: 401 });
    }

    let targetProjectId = projectId;
    let projectInfo: VercelProjectInfo | undefined;

    // If no projectId provided, create a new project
    if (!targetProjectId) {
      const projectName = `bolt-diy-${chatId}-${Date.now()}`;
      const createProjectResponse = await fetch('https://api.vercel.com/v9/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          framework: null,
        }),
      });

      if (!createProjectResponse.ok) {
        const errorData = (await createProjectResponse.json()) as any;
        return json(
          { error: `Failed to create project: ${errorData.error?.message || 'Unknown error'}` },
          { status: 400 },
        );
      }

      const newProject = (await createProjectResponse.json()) as any;
      targetProjectId = newProject.id;
      projectInfo = {
        id: newProject.id,
        name: newProject.name,
        url: `https://${newProject.name}.vercel.app`,
        chatId,
      };
    } else {
      // Get existing project info
      const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${targetProjectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (projectResponse.ok) {
        const existingProject = (await projectResponse.json()) as any;
        projectInfo = {
          id: existingProject.id,
          name: existingProject.name,
          url: `https://${existingProject.name}.vercel.app`,
          chatId,
        };
      } else {
        // If project doesn't exist, create a new one
        const projectName = `bolt-diy-${chatId}-${Date.now()}`;
        const createProjectResponse = await fetch('https://api.vercel.com/v9/projects', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            framework: null,
          }),
        });

        if (!createProjectResponse.ok) {
          const errorData = (await createProjectResponse.json()) as any;
          return json(
            { error: `Failed to create project: ${errorData.error?.message || 'Unknown error'}` },
            { status: 400 },
          );
        }

        const newProject = (await createProjectResponse.json()) as any;
        targetProjectId = newProject.id;
        projectInfo = {
          id: newProject.id,
          name: newProject.name,
          url: `https://${newProject.name}.vercel.app`,
          chatId,
        };
      }
    }

    // Prepare files for deployment
    const deploymentFiles = [];

    for (const [filePath, content] of Object.entries(files)) {
      // Ensure file path doesn't start with a slash for Vercel
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      deploymentFiles.push({
        file: normalizedPath,
        data: content,
      });
    }

    // Create a new deployment
    const deployResponse = await fetch(`https://api.vercel.com/v13/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectInfo.name,
        project: targetProjectId,
        target: 'production',
        files: deploymentFiles,
        routes: [{ src: '/(.*)', dest: '/$1' }],
      }),
    });

    if (!deployResponse.ok) {
      const errorData = (await deployResponse.json()) as any;
      return json(
        { error: `Failed to create deployment: ${errorData.error?.message || 'Unknown error'}` },
        { status: 400 },
      );
    }

    const deployData = (await deployResponse.json()) as any;

    // Poll for deployment status
    let retryCount = 0;
    const maxRetries = 60;
    let deploymentUrl = '';
    let deploymentState = '';

    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.vercel.com/v13/deployments/${deployData.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as any;
        deploymentState = status.readyState;
        deploymentUrl = status.url ? `https://${status.url}` : '';

        if (status.readyState === 'READY' || status.readyState === 'ERROR') {
          break;
        }
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (deploymentState === 'ERROR') {
      return json({ error: 'Deployment failed' }, { status: 500 });
    }

    if (retryCount >= maxRetries) {
      return json({ error: 'Deployment timed out' }, { status: 500 });
    }

    return json({
      success: true,
      deploy: {
        id: deployData.id,
        state: deploymentState,
        url: deploymentUrl || projectInfo.url,
      },
      project: projectInfo,
    });
  } catch (error) {
    console.error('Vercel deploy error:', error);
    return json({ error: 'Deployment failed' }, { status: 500 });
  }
}

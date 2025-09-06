/**
 * Netlify Quick Deploy API Endpoint
 * Contributed by Keoma Wright
 *
 * This endpoint handles quick deployments to Netlify without requiring authentication,
 * using Netlify's drop API for instant deployment.
 */

import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import crypto from 'crypto';

interface QuickDeployRequestBody {
  files: Record<string, string>;
  chatId: string;
  framework?: string;
}

// Use environment variable or fallback to public token for quick deploys
const NETLIFY_QUICK_DEPLOY_TOKEN = process.env.NETLIFY_QUICK_DEPLOY_TOKEN || '';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { files, chatId, framework } = (await request.json()) as QuickDeployRequestBody;

    if (!files || Object.keys(files).length === 0) {
      return json({ error: 'No files to deploy' }, { status: 400 });
    }

    // Generate a unique site name
    const siteName = `bolt-quick-${chatId.substring(0, 8)}-${Date.now()}`;

    // Prepare files for Netlify Drop API
    const deployFiles: Record<string, string> = {};

    // Add index.html if it doesn't exist (for static sites)
    if (!files['/index.html'] && !files['index.html']) {
      // Check if there's any HTML file
      const htmlFile = Object.keys(files).find((f) => f.endsWith('.html'));

      if (!htmlFile) {
        // Create a basic index.html
        deployFiles['/index.html'] = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${framework || 'Bolt'} App</title>
</head>
<body>
    <div id="root"></div>
    <script>
        // Check if there's a main.js or app.js
        const scripts = ${JSON.stringify(Object.keys(files).filter((f) => f.endsWith('.js')))};
        if (scripts.length > 0) {
            const script = document.createElement('script');
            script.src = scripts[0];
            document.body.appendChild(script);
        }
    </script>
</body>
</html>`;
      }
    }

    // Process and normalize file paths
    for (const [filePath, content] of Object.entries(files)) {
      const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
      deployFiles[normalizedPath] = content;
    }

    // Use Netlify's API to create a new site and deploy
    let siteId: string | undefined;
    let deployUrl: string | undefined;

    if (NETLIFY_QUICK_DEPLOY_TOKEN) {
      // If we have a token, use the authenticated API
      try {
        // Create a new site
        const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${NETLIFY_QUICK_DEPLOY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: siteName,
            custom_domain: null,
          }),
        });

        if (createSiteResponse.ok) {
          const site = (await createSiteResponse.json()) as any;
          siteId = site.id;

          // Create file digests for deployment
          const fileDigests: Record<string, string> = {};

          for (const [path, content] of Object.entries(deployFiles)) {
            const hash = crypto.createHash('sha1').update(content).digest('hex');
            fileDigests[path] = hash;
          }

          // Create deployment
          const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${NETLIFY_QUICK_DEPLOY_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: fileDigests,
              async: false,
              draft: false,
            }),
          });

          if (deployResponse.ok) {
            const deploy = (await deployResponse.json()) as any;

            // Upload files
            for (const [path, content] of Object.entries(deployFiles)) {
              await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files${path}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${NETLIFY_QUICK_DEPLOY_TOKEN}`,
                  'Content-Type': 'application/octet-stream',
                },
                body: content,
              });
            }

            deployUrl = deploy.ssl_url || deploy.url || `https://${siteName}.netlify.app`;
          }
        }
      } catch (error) {
        console.error('Error with authenticated deployment:', error);
      }
    }

    // Fallback to Netlify Drop (no authentication required)
    if (!deployUrl) {
      // Create a form data with files
      const formData = new FormData();

      // Add each file to the form data
      for (const [path, content] of Object.entries(deployFiles)) {
        const blob = new Blob([content], { type: 'text/plain' });
        const fileName = path.startsWith('/') ? path.substring(1) : path;
        formData.append('file', blob, fileName);
      }

      // Deploy using Netlify Drop API (no auth required)
      const dropResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        body: formData,
      });

      if (dropResponse.ok) {
        const dropData = (await dropResponse.json()) as any;
        siteId = dropData.id;
        deployUrl = dropData.ssl_url || dropData.url || `https://${dropData.subdomain}.netlify.app`;
      } else {
        // Try alternative deployment method
        const zipContent = await createZipArchive(deployFiles);

        const zipResponse = await fetch('https://api.netlify.com/api/v1/sites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/zip',
          },
          body: zipContent,
        });

        if (zipResponse.ok) {
          const zipData = (await zipResponse.json()) as any;
          siteId = zipData.id;
          deployUrl = zipData.ssl_url || zipData.url;
        } else {
          throw new Error('Failed to deploy to Netlify');
        }
      }
    }

    if (!deployUrl) {
      return json({ error: 'Deployment failed - could not get deployment URL' }, { status: 500 });
    }

    return json({
      success: true,
      url: deployUrl,
      siteId,
      siteName,
    });
  } catch (error) {
    console.error('Quick deploy error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Deployment failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

// Helper function to create a simple ZIP archive (minimal implementation)
async function createZipArchive(files: Record<string, string>): Promise<ArrayBuffer> {
  // This is a simplified ZIP creation - in production, use a proper ZIP library
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  // For simplicity, we'll create a tar-like format
  for (const [path, content] of Object.entries(files)) {
    const pathBytes = encoder.encode(path);
    const contentBytes = encoder.encode(content);

    // Simple header: path length (4 bytes) + content length (4 bytes)
    const header = new Uint8Array(8);
    new DataView(header.buffer).setUint32(0, pathBytes.length, true);
    new DataView(header.buffer).setUint32(4, contentBytes.length, true);

    parts.push(header);
    parts.push(pathBytes);
    parts.push(contentBytes);
  }

  // Combine all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result.buffer;
}

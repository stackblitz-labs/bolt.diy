import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import type {
  DeployRequestBody,
  DeployResponse,
  CloudflareUploadSession,
  CloudflareAssetManifest,
} from '~/types/deployment';

const MAX_BATCH_SIZE = 40 * 1024 * 1024; // 40MB per batch
const MAX_FILES_PER_BATCH = 2000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const MAX_TOTAL_FILES = 20000;

// SSR frameworks that won't work properly with static hosting
const SSR_FRAMEWORKS = ['nextjs', 'remix', 'nuxt', 'sveltekit', 'qwik'];

/**
 * Detect framework from project source files
 */
function detectFramework(files: Record<string, string>): string {
  const packageJson = files['package.json'];

  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for specific frameworks
      if (dependencies.next) {
        return 'nextjs';
      }

      if (dependencies['@remix-run/react']) {
        return 'remix';
      }

      if (dependencies['@nuxt/core'] || dependencies.nuxt) {
        return 'nuxt';
      }

      if (dependencies['@sveltejs/kit']) {
        return 'sveltekit';
      }

      if (dependencies['@builder.io/qwik']) {
        return 'qwik';
      }

      if (dependencies.astro) {
        return 'astro';
      }

      if (dependencies.vite || dependencies['@vitejs/plugin-react']) {
        return 'vite';
      }

      if (dependencies.react) {
        return 'react';
      }

      if (dependencies.vue) {
        return 'vue';
      }

      if (dependencies['@angular/core']) {
        return 'angular';
      }

      return 'nodejs';
    } catch {
      // Invalid JSON, continue to file-based detection
    }
  }

  // Check for config files
  if (files['next.config.js'] || files['next.config.ts'] || files['next.config.mjs']) {
    return 'nextjs';
  }

  if (files['remix.config.js'] || files['remix.config.ts']) {
    return 'remix';
  }

  if (files['nuxt.config.js'] || files['nuxt.config.ts']) {
    return 'nuxt';
  }

  if (files['svelte.config.js'] || files['svelte.config.ts']) {
    return 'sveltekit';
  }

  if (files['astro.config.mjs'] || files['astro.config.js'] || files['astro.config.ts']) {
    return 'astro';
  }

  if (files['vite.config.js'] || files['vite.config.ts']) {
    return 'vite';
  }

  if (files['angular.json']) {
    return 'angular';
  }

  if (files['index.html']) {
    return 'static';
  }

  return 'unknown';
}

/**
 * Deploy to Cloudflare Workers Static Assets
 *
 * Flow:
 * 1. Create upload session with manifest
 * 2. Upload files in batches (max 40MB per batch)
 * 3. Deploy Worker script with ASSETS binding
 * 4. Activate the deployed version
 * 5. Return deploymentId and URL
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;

  try {
    const body = (await request.json()) as DeployRequestBody & { token?: string; accountId?: string };
    const { files, sourceFiles, chatId, authMode = 'platform-managed' } = body;

    // Detect framework from source files if provided
    let detectedFramework: string | undefined;

    if (sourceFiles) {
      detectedFramework = detectFramework(sourceFiles);
      console.log('Detected framework:', detectedFramework);

      // Warn if deploying an SSR framework to static hosting
      if (SSR_FRAMEWORKS.includes(detectedFramework)) {
        console.warn(
          `Warning: Deploying ${detectedFramework} to Cloudflare Workers Static Assets. ` +
            'SSR features will not work. Consider using Vercel or Cloudflare Pages with Git integration for full SSR support.',
        );
      }
    }

    // Determine credentials based on auth mode
    let token: string;
    let accountId: string;
    let workerName: string;

    if (authMode === 'user-token') {
      if (!body.token || !body.accountId) {
        return json({ error: 'Missing Cloudflare credentials' }, { status: 401 });
      }
      token = body.token;
      accountId = body.accountId;
      workerName = `huskit-${chatId}`;
    } else {
      // Platform-managed mode
      if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        return json({ error: 'Platform Cloudflare credentials not configured' }, { status: 500 });
      }
      token = env.CLOUDFLARE_API_TOKEN;
      accountId = env.CLOUDFLARE_ACCOUNT_ID;
      workerName = env.CLOUDFLARE_WORKER_NAME || 'huskit-sites';
    }

    // Validate file limits
    const fileEntries = Object.entries(files);

    console.log(`[Cloudflare Deploy] Received ${fileEntries.length} files to deploy`);
    console.log('[Cloudflare Deploy] File paths:', fileEntries.slice(0, 10).map(([p]) => p));

    if (fileEntries.length === 0) {
      return json({ error: 'No files to deploy' }, { status: 400 });
    }

    if (fileEntries.length > MAX_TOTAL_FILES) {
      return json(
        {
          error: `Too many files. Maximum is ${MAX_TOTAL_FILES}, got ${fileEntries.length}`,
        },
        { status: 400 },
      );
    }

    // Calculate file hashes and build manifest
    const manifest: CloudflareAssetManifest = {};
    const fileContents: Map<string, { path: string; content: string; size: number }> = new Map();

    // Helper to convert string to base64 (needed for hash calculation)
    const stringToBase64 = (str: string): string => {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    for (const [filePath, content] of fileEntries) {
      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
      const contentBytes = new TextEncoder().encode(content);

      if (contentBytes.length > MAX_FILE_SIZE) {
        return json(
          {
            error: `File ${filePath} exceeds maximum size of 25MB`,
          },
          { status: 400 },
        );
      }

      // Calculate hash the same way Cloudflare SDK does:
      // hash = sha256(base64(content) + extension).slice(0, 32)
      const extension = normalizedPath.split('.').pop() || '';
      const base64Content = stringToBase64(content);
      const hashInput = base64Content + extension;
      const hashInputBytes = new TextEncoder().encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashInputBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fullHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      const hashHex = fullHash.substring(0, 32); // Cloudflare expects 32-char hashes

      manifest[normalizedPath] = { hash: hashHex, size: contentBytes.length };
      fileContents.set(hashHex, {
        path: normalizedPath,
        content,
        size: contentBytes.length,
      });
    }

    // Add a unique deployment metadata file to ALWAYS force an upload
    // This ensures we get a proper completion token from the upload API
    const assetMetadataContent = JSON.stringify({
      deployedAt: new Date().toISOString(),
      version: Date.now(),
      chatId,
    });
    const deployMetaBytes = new TextEncoder().encode(assetMetadataContent);
    // Use same hash algorithm: sha256(base64(content) + extension)
    const deployMetaBase64 = stringToBase64(assetMetadataContent);
    const deployMetaHashInput = deployMetaBase64 + 'json';
    const deployMetaHashInputBytes = new TextEncoder().encode(deployMetaHashInput);
    const deployMetaHashBuffer = await crypto.subtle.digest('SHA-256', deployMetaHashInputBytes);
    const deployMetaHashArray = Array.from(new Uint8Array(deployMetaHashBuffer));
    const deployMetaHash = deployMetaHashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

    manifest['/.huskit-deploy.json'] = { hash: deployMetaHash, size: deployMetaBytes.length };
    fileContents.set(deployMetaHash, {
      path: '/.huskit-deploy.json',
      content: assetMetadataContent,
      size: deployMetaBytes.length,
    });

    console.log('[Cloudflare Deploy] Added deployment metadata file to ensure upload');

    // Step 1: Create upload session
    const sessionResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/assets-upload-session`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manifest }),
      },
    );

    if (!sessionResponse.ok) {
      const errorData = (await sessionResponse.json()) as any;
      return json(
        {
          error: `Failed to create upload session: ${errorData.errors?.[0]?.message || sessionResponse.statusText}`,
        },
        { status: sessionResponse.status },
      );
    }

    const sessionData = (await sessionResponse.json()) as { result: CloudflareUploadSession };

    console.log('[Cloudflare Deploy] Session response keys:', Object.keys(sessionData));
    console.log('[Cloudflare Deploy] Session result keys:', Object.keys(sessionData.result || {}));

    const { jwt, buckets } = sessionData.result;

    if (!jwt) {
      return json({ error: 'No JWT returned from upload session' }, { status: 500 });
    }

    console.log('[Cloudflare Deploy] Upload session created');
    console.log('[Cloudflare Deploy] Session JWT (first 50 chars):', jwt.substring(0, 50) + '...');
    console.log('[Cloudflare Deploy] Buckets count:', buckets.length);
    console.log('[Cloudflare Deploy] Total hashes in buckets:', buckets.flat().length);

    // Step 2: Determine which files need uploading from buckets
    // Buckets from assets-upload-session already contain only the hashes that need to be uploaded
    const allHashes = buckets.flat();

    // Step 3: Upload files in batches
    const filesToUpload = allHashes
      .map((hash) => ({ hash, ...fileContents.get(hash)! }))
      .filter((f) => f.path) as Array<{ hash: string; path: string; content: string; size: number }>;

    console.log('[Cloudflare Deploy] Files to upload:', filesToUpload.length);
    console.log('[Cloudflare Deploy] Asset paths in manifest:', Object.keys(manifest));
    console.log('[Cloudflare Deploy] Files being uploaded:', filesToUpload.map((f) => f.path));

    // Group files into batches by size
    const batches: Array<typeof filesToUpload> = [];
    let currentBatch: typeof filesToUpload = [];
    let currentBatchSize = 0;

    for (const file of filesToUpload) {
      if (currentBatch.length >= MAX_FILES_PER_BATCH || currentBatchSize + file.size > MAX_BATCH_SIZE) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentBatchSize = 0;
      }
      currentBatch.push(file);
      currentBatchSize += file.size;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Upload each batch using Workers assets API
    // Track completion token - the final JWT returned after all uploads
    let completionToken = jwt;

    // If no batches to upload, warn that we're using the session JWT directly
    // This should rarely happen since we always add a unique .huskit-deploy.json file
    if (batches.length === 0) {
      console.log(
        '[Cloudflare Deploy] WARNING: No batches to upload. Using session JWT directly. ' +
          'This may cause issues if the JWT lacks deployment scope.',
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const formData = new FormData();

      for (const file of batch) {
        // Use hash as the key and base64-encode the content
        const base64Content = stringToBase64(file.content);
        const blob = new Blob([base64Content], { type: 'application/octet-stream' });
        formData.append(file.hash, blob);
      }

      let uploadSuccess = false;
      let retries = 0;
      const maxRetries = 3;

      while (!uploadSuccess && retries < maxRetries) {
        try {
          const uploadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${completionToken}`,
              },
              body: formData,
            },
          );

          if (uploadResponse.ok) {
            // Capture the completion token from the response
            // Cloudflare API returns jwt at root level, not inside result
            const uploadData = (await uploadResponse.json()) as { jwt?: string; result?: { jwt?: string } };

            console.log(`[Cloudflare Deploy] Batch ${i + 1}/${batches.length} uploaded successfully`);
            console.log('[Cloudflare Deploy] Upload response keys:', Object.keys(uploadData));

            // Check both possible locations for the JWT
            const newJwt = uploadData.jwt || uploadData.result?.jwt;

            if (newJwt) {
              completionToken = newJwt;
              console.log('[Cloudflare Deploy] Got new completion token from upload response');
            } else {
              console.log('[Cloudflare Deploy] No JWT in upload response, using previous token');
            }

            uploadSuccess = true;
          } else if (uploadResponse.status === 429) {
            // Rate limited - wait and retry
            const retryAfter = parseInt(uploadResponse.headers.get('Retry-After') || '5');
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            retries++;
          } else {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
          }
        } catch (error) {
          retries++;

          if (retries >= maxRetries) {
            return json(
              {
                error: `Failed to upload batch ${i + 1}/${batches.length}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
              { status: 500 },
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 2000 * retries));
        }
      }
    }

    // Step 4: Deploy using Beta Workers Versions API (same pattern as official SDK)
    // This properly initializes asset bindings unlike PUT /scripts endpoint
    console.log('[Cloudflare Deploy] Deploying Worker with static assets using Versions API');

    const workerScript = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Debug endpoint to check bindings
    if (url.pathname === '/__debug') {
      return new Response(JSON.stringify({
        bindings: Object.keys(env || {}),
        hasAssets: !!env.ASSETS,
        assetsType: env.ASSETS ? typeof env.ASSETS : 'undefined',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // For SPA: serve index.html for non-asset paths
    // The asset router should handle actual asset files
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    // Fallback if ASSETS binding is not available
    return new Response(JSON.stringify({
      error: 'ASSETS binding not available',
      path: url.pathname,
      envKeys: Object.keys(env || {}),
      envType: typeof env,
      envStringified: JSON.stringify(env),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}`;

    const scriptFilename = `${workerName}.mjs`;
    const compatibilityDate = new Date().toISOString().split('T')[0];

    // Step 4: Deploy using PUT /scripts with assets
    // PUT creates/updates the worker AND its assets in one call
    // NOTE: Don't delete the worker - it would invalidate the asset upload session
    console.log('[Cloudflare Deploy] Deploying Worker with static assets...');

    // Build metadata for PUT /scripts endpoint
    // https://developers.cloudflare.com/workers/static-assets/direct-upload
    const deployMetadata = {
      main_module: scriptFilename,
      compatibility_date: compatibilityDate,
      // The assets.jwt links the uploaded files
      assets: {
        jwt: completionToken,
        config: {
          html_handling: 'auto-trailing-slash',
          not_found_handling: 'single-page-application',
          run_worker_first: true,
        },
      },
      // The bindings array creates env.ASSETS in the Worker
      bindings: [
        {
          type: 'assets',
          name: 'ASSETS',
        },
      ],
    };

    console.log('[Cloudflare Deploy] Deploy metadata:', JSON.stringify(deployMetadata, null, 2));
    console.log('[Cloudflare Deploy] Completion token (first 50 chars):', completionToken.substring(0, 50) + '...');
    console.log('[Cloudflare Deploy] Worker script length:', workerScript.length);

    // Use FormData for multipart/form-data
    const deployFormData = new FormData();
    deployFormData.append(
      'metadata',
      new Blob([JSON.stringify(deployMetadata)], { type: 'application/json' }),
    );
    deployFormData.append(
      scriptFilename,
      new Blob([workerScript], { type: 'application/javascript+module' }),
      scriptFilename,
    );

    // PUT /scripts - creates worker with assets and deploys immediately
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: deployFormData,
      },
    );

    if (!deployResponse.ok) {
      const errorData = (await deployResponse.json()) as any;
      console.error('[Cloudflare Deploy] PUT /scripts failed:', errorData);
      return json(
        { error: `Failed to deploy: ${errorData.errors?.[0]?.message || deployResponse.statusText}` },
        { status: deployResponse.status },
      );
    }

    const deployResult = (await deployResponse.json()) as any;
    console.log('[Cloudflare Deploy] PUT /scripts successful');
    console.log('[Cloudflare Deploy] Deploy result:', JSON.stringify(deployResult, null, 2));
    console.log('[Cloudflare Deploy] Result bindings:', JSON.stringify(deployResult.result?.bindings, null, 2));
    console.log('[Cloudflare Deploy] Result pipeline_hash:', deployResult.result?.pipeline_hash);

    // Step 5: Generate deployment ID and URL
    const deploymentId = `cf-${chatId}-${Date.now()}`;
    const deploymentUrl = `https://${workerName}.workers.dev`;

    // TODO: Store deployment record in database

    return json({
      success: true,
      deploymentId,
      status: 'ready',
      url: deploymentUrl,
      framework: detectedFramework,
      isSSRFramework: detectedFramework ? SSR_FRAMEWORKS.includes(detectedFramework) : false,
    } as DeployResponse & { framework?: string; isSSRFramework?: boolean });
  } catch (error) {
    console.error('Cloudflare deploy error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Deployment failed',
      },
      { status: 500 },
    );
  }
}


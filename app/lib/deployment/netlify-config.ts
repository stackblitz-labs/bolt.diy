/**
 * Netlify Configuration Helper
 * Contributed by Keoma Wright
 *
 * This module provides automatic configuration generation for Netlify deployments
 */

export interface NetlifyConfig {
  build: {
    command?: string;
    publish: string;
    functions?: string;
    environment?: Record<string, string>;
  };
  redirects?: Array<{
    from: string;
    to: string;
    status?: number;
    force?: boolean;
  }>;
  headers?: Array<{
    for: string;
    values: Record<string, string>;
  }>;
  functions?: {
    [key: string]: {
      included_files?: string[];
      external_node_modules?: string[];
    };
  };
}

export interface FrameworkConfig {
  name: string;
  buildCommand: string;
  outputDirectory: string;
  nodeVersion: string;
  installCommand?: string;
  envVars?: Record<string, string>;
}

const FRAMEWORK_CONFIGS: Record<string, FrameworkConfig> = {
  react: {
    name: 'React',
    buildCommand: 'npm run build',
    outputDirectory: 'build',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  'react-vite': {
    name: 'React (Vite)',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  vue: {
    name: 'Vue',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  angular: {
    name: 'Angular',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  svelte: {
    name: 'Svelte',
    buildCommand: 'npm run build',
    outputDirectory: 'public',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  'svelte-kit': {
    name: 'SvelteKit',
    buildCommand: 'npm run build',
    outputDirectory: '.svelte-kit',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  next: {
    name: 'Next.js',
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    nodeVersion: '18',
    installCommand: 'npm install',
    envVars: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
  nuxt: {
    name: 'Nuxt',
    buildCommand: 'npm run build',
    outputDirectory: '.output/public',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  gatsby: {
    name: 'Gatsby',
    buildCommand: 'npm run build',
    outputDirectory: 'public',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  remix: {
    name: 'Remix',
    buildCommand: 'npm run build',
    outputDirectory: 'public',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  astro: {
    name: 'Astro',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    nodeVersion: '18',
    installCommand: 'npm install',
  },
  static: {
    name: 'Static Site',
    buildCommand: '',
    outputDirectory: '.',
    nodeVersion: '18',
  },
};

export function detectFramework(packageJson: any): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Check for specific frameworks
  if (deps.next) {
    return 'next';
  }

  if (deps.nuxt || deps.nuxt3) {
    return 'nuxt';
  }

  if (deps.gatsby) {
    return 'gatsby';
  }

  if (deps['@remix-run/react']) {
    return 'remix';
  }

  if (deps.astro) {
    return 'astro';
  }

  if (deps['@angular/core']) {
    return 'angular';
  }

  if (deps['@sveltejs/kit']) {
    return 'svelte-kit';
  }

  if (deps.svelte) {
    return 'svelte';
  }

  if (deps.vue) {
    return 'vue';
  }

  if (deps.react) {
    if (deps.vite) {
      return 'react-vite';
    }

    return 'react';
  }

  return 'static';
}

export function generateNetlifyConfig(framework: string, customConfig?: Partial<NetlifyConfig>): NetlifyConfig {
  const frameworkConfig = FRAMEWORK_CONFIGS[framework] || FRAMEWORK_CONFIGS.static;

  const config: NetlifyConfig = {
    build: {
      command: frameworkConfig.buildCommand,
      publish: frameworkConfig.outputDirectory,
      environment: {
        NODE_VERSION: frameworkConfig.nodeVersion,
        ...frameworkConfig.envVars,
        ...customConfig?.build?.environment,
      },
    },
    redirects: [],
    headers: [
      {
        for: '/*',
        values: {
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
    ],
  };

  // Add SPA redirect for client-side routing frameworks
  if (['react', 'react-vite', 'vue', 'angular', 'svelte'].includes(framework)) {
    config.redirects!.push({
      from: '/*',
      to: '/index.html',
      status: 200,
    });
  }

  // Add custom headers for static assets
  config.headers!.push({
    for: '/assets/*',
    values: {
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });

  // Merge with custom config
  if (customConfig) {
    if (customConfig.redirects) {
      config.redirects!.push(...customConfig.redirects);
    }

    if (customConfig.headers) {
      config.headers!.push(...customConfig.headers);
    }

    if (customConfig.functions) {
      config.functions = customConfig.functions;
    }
  }

  return config;
}

export function generateNetlifyToml(config: NetlifyConfig): string {
  let toml = '';

  // Build configuration
  toml += '[build]\n';

  if (config.build.command) {
    toml += `  command = "${config.build.command}"\n`;
  }

  toml += `  publish = "${config.build.publish}"\n`;

  if (config.build.functions) {
    toml += `  functions = "${config.build.functions}"\n`;
  }

  // Environment variables
  if (config.build.environment && Object.keys(config.build.environment).length > 0) {
    toml += '\n[build.environment]\n';

    for (const [key, value] of Object.entries(config.build.environment)) {
      toml += `  ${key} = "${value}"\n`;
    }
  }

  // Redirects
  if (config.redirects && config.redirects.length > 0) {
    for (const redirect of config.redirects) {
      toml += '\n[[redirects]]\n';
      toml += `  from = "${redirect.from}"\n`;
      toml += `  to = "${redirect.to}"\n`;

      if (redirect.status) {
        toml += `  status = ${redirect.status}\n`;
      }

      if (redirect.force) {
        toml += `  force = ${redirect.force}\n`;
      }
    }
  }

  // Headers
  if (config.headers && config.headers.length > 0) {
    for (const header of config.headers) {
      toml += '\n[[headers]]\n';
      toml += `  for = "${header.for}"\n`;

      if (Object.keys(header.values).length > 0) {
        toml += '  [headers.values]\n';

        for (const [key, value] of Object.entries(header.values)) {
          toml += `    "${key}" = "${value}"\n`;
        }
      }
    }
  }

  // Functions configuration
  if (config.functions) {
    for (const [funcName, funcConfig] of Object.entries(config.functions)) {
      toml += `\n[functions."${funcName}"]\n`;

      if (funcConfig.included_files) {
        toml += `  included_files = ${JSON.stringify(funcConfig.included_files)}\n`;
      }

      if (funcConfig.external_node_modules) {
        toml += `  external_node_modules = ${JSON.stringify(funcConfig.external_node_modules)}\n`;
      }
    }
  }

  return toml;
}

export function validateDeploymentFiles(files: Record<string, string>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for index.html
  const hasIndex = Object.keys(files).some(
    (path) => path === '/index.html' || path === 'index.html' || path.endsWith('/index.html'),
  );

  if (!hasIndex) {
    warnings.push('No index.html file found. Make sure your build output includes an entry point.');
  }

  // Check file sizes
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  for (const [path, content] of Object.entries(files)) {
    const size = new Blob([content]).size;

    if (size > MAX_FILE_SIZE) {
      errors.push(`File ${path} exceeds maximum size of 100MB`);
    } else if (size > WARN_FILE_SIZE) {
      warnings.push(`File ${path} is large (${Math.round(size / 1024 / 1024)}MB)`);
    }
  }

  // Check total deployment size
  const totalSize = Object.values(files).reduce((sum, content) => sum + new Blob([content]).size, 0);

  const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB

  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push(`Total deployment size exceeds 500MB limit`);
  }

  // Check for common issues
  if (Object.keys(files).some((path) => path.includes('node_modules'))) {
    warnings.push('Deployment includes node_modules - these should typically be excluded');
  }

  if (Object.keys(files).some((path) => path.includes('.env'))) {
    errors.push('Deployment includes .env file - remove sensitive configuration files');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

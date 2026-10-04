import type { FileMap } from '~/lib/stores/files';
import { WORK_DIR } from '~/utils/constants';

const PACKAGE_JSON_PATH = `${WORK_DIR}/package.json`;
const FALLBACK_PACKAGE_JSON_PATH = 'package.json';

const getPackageJsonContent = (files?: FileMap): string | undefined => {
  if (!files) {
    return undefined;
  }

  const direct = files[PACKAGE_JSON_PATH] || files[FALLBACK_PACKAGE_JSON_PATH];

  if (!direct || direct.type !== 'file') {
    return undefined;
  }

  if (typeof direct.content !== 'string') {
    return undefined;
  }

  return direct.content;
};

export const detectFrameworkFromFiles = (files?: FileMap): string | null => {
  const content = getPackageJsonContent(files);

  if (!content) {
    return null;
  }

  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };

    const has = (name: string) => Boolean(deps[name]);
    const hasPrefix = (prefix: string) => Object.keys(deps).some((key) => key.startsWith(prefix));

    if (has('expo')) {
      return 'Expo (React Native)';
    }

    if (has('react-native')) {
      return 'React Native';
    }

    if (has('next')) {
      return 'Next.js';
    }

    if (hasPrefix('@remix-run/')) {
      return 'Remix';
    }

    if (has('astro')) {
      return 'Astro';
    }

    if (has('@sveltejs/kit')) {
      return 'SvelteKit';
    }

    if (has('svelte')) {
      return 'Svelte';
    }

    if (has('nuxt')) {
      return 'Nuxt';
    }

    if (has('vue')) {
      return 'Vue';
    }

    if (has('@angular/core')) {
      return 'Angular';
    }

    if (has('@builder.io/qwik')) {
      return 'Qwik';
    }

    if (has('solid-js')) {
      return 'SolidJS';
    }

    if (has('vite') && has('react')) {
      return 'React + Vite';
    }

    if (has('react')) {
      return 'React';
    }

    if (has('preact')) {
      return 'Preact';
    }

    if (has('vite')) {
      return 'Vite';
    }
  } catch (error) {
    console.warn('Failed to parse package.json for framework detection', error);
  }

  return null;
};

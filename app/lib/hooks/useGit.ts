import type { WebContainer } from '@webcontainer/api';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { webcontainer as webcontainerPromise } from '~/lib/webcontainer';
import git, { type GitAuth, type PromiseFsClient } from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';

// Set the custom path implementation before any git operations
const customPath = {
  join: (...parts: string[]): string => parts.join('/').replace(/\/+/g, '/'),
  dirname: (path: string): string => {
    if (!path || !path.includes('/')) {
      return '.';
    }

    path = path.replace(/\/+$/, '');

    return path.split('/').slice(0, -1).join('/') || '/';
  },
  basename: (path: string, ext?: string): string => {
    path = path.replace(/\/+$/, '');

    const base = path.split('/').pop() || '';

    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }

    return base;
  },
  relative: (from: string, to: string): string => {
    from = from.replace(/\/+$/, '');
    to = to.replace(/\/+$/, '');

    if (from === to) {
      return '';
    }

    if (to.startsWith(from + '/')) {
      return to.slice(from.length + 1);
    }

    return to;
  },
};

// Set the custom path implementation globally for isomorphic-git
(git as any).cores?.create('default').set('fs', customPath);

// Create a wrapper around git.clone that uses our custom path module
const gitCloneWithCustomPath = async (options: Parameters<typeof git.clone>[0]): Promise<void> => {
  // Store the original path module
  const originalPath = (git as any)._path;

  try {
    // Replace the path module with our custom one
    (git as any)._path = customPath;

    // Call the original clone function
    return await git.clone(options);
  } finally {
    // Restore the original path module
    (git as any)._path = originalPath;
  }
};

const lookupSavedPassword = (url: string) => {
  const domain = url.split('/')[2];
  const gitCreds = Cookies.get(`git:${domain}`);

  if (!gitCreds) {
    return null;
  }

  try {
    const { username, password } = JSON.parse(gitCreds || '{}');
    return { username, password };
  } catch (error) {
    console.log(`Failed to parse Git Cookie ${error}`);
    return null;
  }
};

const saveGitAuth = (url: string, auth: GitAuth) => {
  const domain = url.split('/')[2];
  Cookies.set(`git:${domain}`, JSON.stringify(auth));
};

export function useGit() {
  const [ready, setReady] = useState(false);
  const [webcontainer, setWebcontainer] = useState<WebContainer>();
  const [fs, setFs] = useState<PromiseFsClient>();
  const fileData = useRef<Record<string, { data: any; encoding?: string }>>({});
  useEffect(() => {
    webcontainerPromise.then((container) => {
      fileData.current = {};
      setWebcontainer(container);
      setFs(getFs(container, fileData));
      setReady(true);
    });
  }, []);

  const gitClone = useCallback(
    async (url: string) => {
      if (!webcontainer || !fs || !ready) {
        throw 'Webcontainer not initialized';
      }

      fileData.current = {};

      const headers: {
        [x: string]: string;
      } = {
        'User-Agent': 'bolt.diy',
      };

      const auth = lookupSavedPassword(url);

      if (auth) {
        headers.Authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
      }

      try {
        await gitCloneWithCustomPath({
          fs,
          http,
          dir: webcontainer.workdir,
          url,
          depth: 1,
          singleBranch: true,
          corsProxy: '/api/git-proxy',
          headers,

          onAuth: (url: string) => {
            let auth = lookupSavedPassword(url);

            if (auth) {
              return auth;
            }

            if (confirm('This repo is password protected. Ready to enter a username & password?')) {
              auth = {
                username: prompt('Enter username'),
                password: prompt('Enter password'),
              };
              return auth;
            } else {
              return { cancel: true };
            }
          },
          onAuthFailure: (url: string, _auth: GitAuth) => {
            toast.error(`Error Authenticating with ${url.split('/')[2]}`);
            throw `Error Authenticating with ${url.split('/')[2]}`;
          },
          onAuthSuccess: (url: string, auth: GitAuth) => {
            saveGitAuth(url, auth);
          },
        });

        const data: Record<string, { data: any; encoding?: string }> = {};

        for (const [key, value] of Object.entries(fileData.current)) {
          data[key] = value;
        }

        return { workdir: webcontainer.workdir, data };
      } catch (error) {
        console.error('Git clone error:', error);

        // toast.error(`Git clone error ${(error as any).message||""}`);
        throw error;
      }
    },
    [webcontainer, fs, ready],
  );

  return { ready, gitClone };
}

const getFs = (
  webcontainer: WebContainer,
  record: MutableRefObject<Record<string, { data: any; encoding?: string }>>,
) => ({
  promises: {
    readFile: async (path: string, options: any) => {
      const encoding = options?.encoding;
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        const result = await webcontainer.fs.readFile(relativePath, encoding);

        return result;
      } catch (error) {
        throw error;
      }
    },
    writeFile: async (path: string, data: any, options: any) => {
      const encoding = options.encoding;
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      if (record.current) {
        record.current[relativePath] = { data, encoding };
      }

      try {
        const result = await webcontainer.fs.writeFile(relativePath, data, { ...options, encoding });

        return result;
      } catch (error) {
        throw error;
      }
    },
    mkdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        const result = await webcontainer.fs.mkdir(relativePath, { ...options, recursive: true });

        return result;
      } catch (error) {
        throw error;
      }
    },
    readdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        const result = await webcontainer.fs.readdir(relativePath, options);

        return result;
      } catch (error) {
        throw error;
      }
    },
    rm: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        const result = await webcontainer.fs.rm(relativePath, { ...(options || {}) });

        return result;
      } catch (error) {
        throw error;
      }
    },
    rmdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        const result = await webcontainer.fs.rm(relativePath, { recursive: true, ...options });

        return result;
      } catch (error) {
        throw error;
      }
    },
    unlink: async (path: string) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);

      try {
        return await webcontainer.fs.rm(relativePath, { recursive: false });
      } catch (error) {
        throw error;
      }
    },
    stat: async (path: string) => {
      try {
        const relativePath = pathUtils.relative(webcontainer.workdir, path);
        const resp = await webcontainer.fs.readdir(pathUtils.dirname(relativePath), { withFileTypes: true });
        const name = pathUtils.basename(relativePath);
        const fileInfo = resp.find((x) => x.name == name);

        if (!fileInfo) {
          throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
        }

        return {
          isFile: () => fileInfo.isFile(),
          isDirectory: () => fileInfo.isDirectory(),
          isSymbolicLink: () => false,
          size: 1,
          mode: 0o666, // Default permissions
          mtimeMs: Date.now(),
          uid: 1000,
          gid: 1000,
        };
      } catch (error: any) {
        console.log(error?.message);

        const err = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        err.errno = -2;
        err.syscall = 'stat';
        err.path = path;
        throw err;
      }
    },
    lstat: async (path: string) => {
      return await getFs(webcontainer, record).promises.stat(path);
    },
    readlink: async (path: string) => {
      throw new Error(`EINVAL: invalid argument, readlink '${path}'`);
    },
    symlink: async (target: string, path: string) => {
      /*
       * Since WebContainer doesn't support symlinks,
       * we'll throw a "operation not supported" error
       */
      throw new Error(`EPERM: operation not permitted, symlink '${target}' -> '${path}'`);
    },

    chmod: async (_path: string, _mode: number) => {
      /*
       * WebContainer doesn't support changing permissions,
       * but we can pretend it succeeded for compatibility
       */
      return await Promise.resolve();
    },
  },
});

const pathUtils = {
  dirname: (path: string) => customPath.dirname(path),
  basename: (path: string, ext?: string) => customPath.basename(path, ext),
  relative: (from: string, to: string) => customPath.relative(from, to),
};

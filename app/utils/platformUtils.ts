export type Platform = 'win32' | 'darwin' | 'linux' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface PlatformInfo {
  platform: Platform;
  isWindows: boolean;
  isUnix: boolean;
  shell: string;
}

export function detectPlatform(): PlatformInfo {
  const platform = (typeof process !== 'undefined' ? process.platform : 'unknown') as Platform;
  const isWindows = platform === 'win32';
  const isUnix = !isWindows && platform !== 'unknown';

  let shell = 'sh';

  if (typeof process !== 'undefined') {
    if (isWindows) {
      shell = process.env.ComSpec || 'cmd.exe';
    } else {
      shell = process.env.SHELL || 'sh';
    }
  }

  return {
    platform,
    isWindows,
    isUnix,
    shell,
  };
}

export function createEnvPrefix(envVars: Record<string, string>): string {
  const platformInfo = detectPlatform();

  if (platformInfo.isWindows) {
    const setCommands = Object.entries(envVars)
      .map(([key, value]) => `set ${key}=${value}`)
      .join(' && ');
    return setCommands + (setCommands ? ' && ' : '');
  } else {
    return Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
  }
}

export function createTimeoutCommand(seconds: number, command: string): string {
  const platformInfo = detectPlatform();

  if (platformInfo.isWindows) {
    return `timeout /t ${seconds} >nul 2>&1 || (${command})`;
  } else if (platformInfo.platform === 'darwin') {
    return `gtimeout ${seconds}s ${command} || timeout ${seconds}s ${command} || ${command}`;
  } else {
    return `timeout ${seconds}s ${command} || ${command}`;
  }
}

export function createInstallCommand(
  packageManager: PackageManager,
  envVars: Record<string, string> = {},
  options: {
    silent?: boolean;
    production?: boolean;
    offline?: boolean;
    legacyPeerDeps?: boolean;
    noAudit?: boolean;
    noFund?: boolean;
    retries?: number;
  } = {},
): string {
  const {
    silent = true,
    production = false,
    offline = true,
    legacyPeerDeps = true,
    noAudit = true,
    noFund = true,
    retries = 3,
  } = options;

  const envPrefix = createEnvPrefix({
    NODE_ENV: production ? 'production' : 'development',
    npm_config_production: production ? 'true' : 'false',
    ...envVars,
  });

  const baseFlags = {
    npm: [
      noAudit && '--no-audit',
      noFund && '--no-fund',
      silent && '--silent',
      offline && '--prefer-offline',
      legacyPeerDeps && '--legacy-peer-deps',
    ],
    yarn: [
      '--non-interactive',
      silent && '--silent',
      offline && '--prefer-offline',
      retries > 0 && `--network-timeout=60000`,
    ],
    pnpm: [silent && '--silent', offline && '--prefer-offline'],
    bun: ['-y', silent && '--silent'],
  };

  const flags = baseFlags[packageManager].filter(Boolean).join(' ');
  const command = `${packageManager} install ${flags}`.trim();

  return envPrefix ? `${envPrefix} ${command}` : command;
}

export function createRunCommand(packageManager: PackageManager, script: string): string {
  const runCommands = {
    npm: 'npm run',
    yarn: 'yarn run',
    pnpm: 'pnpm run',
    bun: 'bun run',
  };

  return `${runCommands[packageManager]} ${script}`;
}

export function detectPackageManager(hasFile: (name: string) => boolean): {
  pm: PackageManager;
  confidence: 'high' | 'medium' | 'low';
} {
  if (hasFile('pnpm-lock.yaml')) {
    return { pm: 'pnpm', confidence: 'high' };
  }

  if (hasFile('yarn.lock')) {
    return { pm: 'yarn', confidence: 'high' };
  }

  if (hasFile('bun.lockb')) {
    return { pm: 'bun', confidence: 'high' };
  }

  if (hasFile('package-lock.json')) {
    return { pm: 'npm', confidence: 'high' };
  }

  return { pm: 'npm', confidence: 'low' };
}

export function createFallbackInstallCommand(packageManager: PackageManager): string {
  const platformInfo = detectPlatform();
  const installCmd = createInstallCommand(
    packageManager,
    {},
    {
      silent: false,
      offline: false,
      retries: 1,
    },
  );

  if (platformInfo.isWindows) {
    return `${installCmd} || echo "Install failed, but continuing..."`;
  } else {
    return `${installCmd} || (echo "Install failed, but continuing..." && exit 0)`;
  }
}

export function createShadcnInitCommand(): string {
  const platformInfo = detectPlatform();
  const baseCommand = 'npx --yes shadcn@latest init -y --defaults';

  if (platformInfo.isWindows) {
    return `${baseCommand} || echo "shadcn init skipped"`;
  } else {
    return createTimeoutCommand(30, baseCommand) + ' || echo "shadcn init skipped"';
  }
}

export function escapePlatformPath(path: string): string {
  const platformInfo = detectPlatform();

  if (platformInfo.isWindows) {
    return path.includes(' ') ? `"${path}"` : path;
  } else {
    return path.replace(/ /g, '\\ ');
  }
}

export interface ExpoProjectInfo {
  isExpo: boolean;
  hasExpoConfig: boolean;
  hasMetroConfig: boolean;
  expoCliType: 'local' | 'global' | 'npx' | 'none';
  workflowType: 'managed' | 'bare' | 'unknown';
}

export function detectExpoProject(
  hasFile: (name: string) => boolean,
  dependencies: Record<string, string> = {},
): ExpoProjectInfo {
  const hasExpoConfig = hasFile('app.json') || hasFile('app.config.js') || hasFile('app.config.ts');
  const hasMetroConfig = hasFile('metro.config.js') || hasFile('metro.config.ts');

  const hasExpoDep = Boolean(
    dependencies.expo ||
      dependencies['@expo/cli'] ||
      dependencies['expo-cli'] ||
      Object.keys(dependencies).some((dep) => dep.startsWith('expo-')),
  );

  const hasReactNativeDep = Boolean(
    dependencies['react-native'] ||
      dependencies['@react-native/cli'] ||
      Object.keys(dependencies).some((dep) => dep.startsWith('react-native-')),
  );

  const isExpo = hasExpoDep || (hasExpoConfig && hasReactNativeDep);

  let expoCliType: 'local' | 'global' | 'npx' | 'none' = 'none';

  if (dependencies['@expo/cli']) {
    expoCliType = 'local';
  } else if (dependencies['expo-cli']) {
    expoCliType = 'local';
  } else if (isExpo) {
    expoCliType = 'npx';
  }

  let workflowType: 'managed' | 'bare' | 'unknown' = 'unknown';

  if (isExpo) {
    workflowType = hasFile('ios') || hasFile('android') ? 'bare' : 'managed';
  }

  return {
    isExpo,
    hasExpoConfig,
    hasMetroConfig,
    expoCliType,
    workflowType,
  };
}

export function createExpoStartCommand(
  expoInfo: ExpoProjectInfo,
  options: {
    mode?: 'tunnel' | 'localhost' | 'lan';
    platform?: 'ios' | 'android' | 'web';
    clear?: boolean;
  } = {},
): string {
  const { mode = 'tunnel', platform, clear = true } = options;

  let baseCommand = '';

  if (expoInfo.expoCliType === 'local') {
    baseCommand = 'npx expo start';
  } else if (expoInfo.expoCliType === 'global') {
    baseCommand = 'expo start';
  } else {
    baseCommand = 'npx expo start';
  }

  const flags = [];

  if (mode !== 'localhost') {
    flags.push(`--${mode}`);
  }

  if (platform) {
    flags.push(`--${platform}`);
  }

  if (clear) {
    flags.push('--clear');
  }

  return `${baseCommand}${flags.length ? ' ' + flags.join(' ') : ''}`;
}

export function createExpoSetupCommand(packageManager: PackageManager, expoInfo: ExpoProjectInfo): string {
  const envVars = {
    NODE_ENV: 'development',
    npm_config_production: 'false',
  };

  let setupCommand = createInstallCommand(packageManager, envVars, {
    silent: true,
    production: false,
    offline: true,
    legacyPeerDeps: true,
    noAudit: true,
    noFund: true,
    retries: 3,
  });

  if (expoInfo.expoCliType === 'none' || expoInfo.expoCliType === 'npx') {
    const platformInfo = detectPlatform();

    if (platformInfo.isWindows) {
      setupCommand += ' && echo "Expo CLI will be downloaded via npx when needed"';
    } else {
      setupCommand += ' && echo "Expo CLI will be downloaded via npx when needed"';
    }
  }

  return setupCommand;
}

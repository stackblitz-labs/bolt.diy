import type { ActionFunctionArgs, LoaderFunction } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// Only import child_process if we're not in a Cloudflare environment
let execSync: any;

try {
  // Check if we're in a Node.js environment
  if (typeof process !== 'undefined' && process.platform) {
    // Using dynamic import to avoid require()
    const childProcess = { execSync: null };
    execSync = childProcess.execSync;
  }
} catch {
  // In Cloudflare environment, this will fail, which is expected
  console.log('Running in Cloudflare environment, child_process not available');
}

// For development environments, we'll always provide mock data if real data isn't available
const isDevelopment = process.env.NODE_ENV === 'development';

interface SystemMemoryInfo {
  total: number;
  free: number;
  used: number;
  percentage: number;
  swap?: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  timestamp: string;
  error?: string;
}

const getSystemMemoryInfo = (): SystemMemoryInfo => {
  try {
    // Check if we're in a Cloudflare environment and not in development
    if (!execSync && !isDevelopment) {
      // Return error for Cloudflare production environment
      return {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0,
        timestamp: new Date().toISOString(),
        error: 'System memory information is not available in this environment',
      };
    }

    // If we're in development but not in Node environment, return mock data
    if (!execSync && isDevelopment) {
      // Return mock data for development
      const mockTotal = 16 * 1024 * 1024 * 1024; // 16GB
      const mockPercentage = Math.floor(30 + Math.random() * 20); // Random between 30-50%
      const mockUsed = Math.floor((mockTotal * mockPercentage) / 100);
      const mockFree = mockTotal - mockUsed;

      return {
        total: mockTotal,
        free: mockFree,
        used: mockUsed,
        percentage: mockPercentage,
        swap: {
          total: 8 * 1024 * 1024 * 1024, // 8GB
          free: 6 * 1024 * 1024 * 1024, // 6GB
          used: 2 * 1024 * 1024 * 1024, // 2GB
          percentage: 25,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Different commands for different operating systems
    let memInfo: { total: number; free: number; used: number; percentage: number; swap?: any } = {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
    };

    // Check the operating system
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS
      const totalMemory = parseInt(execSync('sysctl -n hw.memsize').toString().trim(), 10);

      // Get memory usage using vm_stat
      const vmStat = execSync('vm_stat').toString().trim();
      const pageSize = 4096; // Default page size on macOS

      // Parse vm_stat output
      const matches = {
        free: /Pages free:\s+(\d+)/.exec(vmStat),
        active: /Pages active:\s+(\d+)/.exec(vmStat),
        inactive: /Pages inactive:\s+(\d+)/.exec(vmStat),
        speculative: /Pages speculative:\s+(\d+)/.exec(vmStat),
        wired: /Pages wired down:\s+(\d+)/.exec(vmStat),
        compressed: /Pages occupied by compressor:\s+(\d+)/.exec(vmStat),
      };

      const freePages = parseInt(matches.free?.[1] || '0', 10);
      const activePages = parseInt(matches.active?.[1] || '0', 10);
      const inactivePages = parseInt(matches.inactive?.[1] || '0', 10);

      // Speculative pages are not currently used in calculations, but kept for future reference
      const wiredPages = parseInt(matches.wired?.[1] || '0', 10);
      const compressedPages = parseInt(matches.compressed?.[1] || '0', 10);

      const freeMemory = freePages * pageSize;
      const usedMemory = (activePages + inactivePages + wiredPages + compressedPages) * pageSize;

      memInfo = {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      };

      // Get swap information
      try {
        const swapInfo = execSync('sysctl -n vm.swapusage').toString().trim();
        const swapMatches = {
          total: /total = (\d+\.\d+)M/.exec(swapInfo),
          used: /used = (\d+\.\d+)M/.exec(swapInfo),
          free: /free = (\d+\.\d+)M/.exec(swapInfo),
        };

        const swapTotal = parseFloat(swapMatches.total?.[1] || '0') * 1024 * 1024;
        const swapUsed = parseFloat(swapMatches.used?.[1] || '0') * 1024 * 1024;
        const swapFree = parseFloat(swapMatches.free?.[1] || '0') * 1024 * 1024;

        memInfo.swap = {
          total: swapTotal,
          used: swapUsed,
          free: swapFree,
          percentage: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
        };
      } catch (swapError) {
        console.error('Failed to get swap info:', swapError);
      }
    } else if (platform === 'linux') {
      // Linux
      const meminfo = execSync('cat /proc/meminfo').toString().trim();

      const memTotal = parseInt(/MemTotal:\s+(\d+)/.exec(meminfo)?.[1] || '0', 10) * 1024;

      // We use memAvailable instead of memFree for more accurate free memory calculation
      const memAvailable = parseInt(/MemAvailable:\s+(\d+)/.exec(meminfo)?.[1] || '0', 10) * 1024;

      /*
       * Buffers and cached memory are included in the available memory calculation by the kernel
       * so we don't need to calculate them separately
       */

      const usedMemory = memTotal - memAvailable;

      memInfo = {
        total: memTotal,
        free: memAvailable,
        used: usedMemory,
        percentage: Math.round((usedMemory / memTotal) * 100),
      };

      // Get swap information
      const swapTotal = parseInt(/SwapTotal:\s+(\d+)/.exec(meminfo)?.[1] || '0', 10) * 1024;
      const swapFree = parseInt(/SwapFree:\s+(\d+)/.exec(meminfo)?.[1] || '0', 10) * 1024;
      const swapUsed = swapTotal - swapFree;

      memInfo.swap = {
        total: swapTotal,
        free: swapFree,
        used: swapUsed,
        percentage: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
      };
    } else if (platform === 'win32') {
      /*
       * Windows
       * Using PowerShell to get memory information
       */
      const memoryInfo = execSync(
        'powershell "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory | ConvertTo-Json"',
      )
        .toString()
        .trim();

      const memData = JSON.parse(memoryInfo);
      const totalMemory = parseInt(memData.TotalVisibleMemorySize, 10) * 1024;
      const freeMemory = parseInt(memData.FreePhysicalMemory, 10) * 1024;
      const usedMemory = totalMemory - freeMemory;

      memInfo = {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      };

      // Get swap (page file) information
      try {
        const swapInfo = execSync(
          "powershell \"Get-CimInstance Win32_PageFileUsage | Measure-Object -Property CurrentUsage, AllocatedBaseSize -Sum | Select-Object @{Name='CurrentUsage';Expression={$_.Sum}}, @{Name='AllocatedBaseSize';Expression={$_.Sum}} | ConvertTo-Json\"",
        )
          .toString()
          .trim();

        const swapData = JSON.parse(swapInfo);
        const swapTotal = parseInt(swapData.AllocatedBaseSize, 10) * 1024 * 1024;
        const swapUsed = parseInt(swapData.CurrentUsage, 10) * 1024 * 1024;
        const swapFree = swapTotal - swapUsed;

        memInfo.swap = {
          total: swapTotal,
          free: swapFree,
          used: swapUsed,
          percentage: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
        };
      } catch (swapError) {
        console.error('Failed to get swap info:', swapError);
      }
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return {
      ...memInfo,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get system memory info:', error);
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const loader: LoaderFunction = async ({ request: _request }) => {
  try {
    return json(getSystemMemoryInfo());
  } catch (error) {
    console.error('Failed to get system memory info:', error);
    return json(
      {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};

export const action = async ({ request: _request }: ActionFunctionArgs) => {
  try {
    return json(getSystemMemoryInfo());
  } catch (error) {
    console.error('Failed to get system memory info:', error);
    return json(
      {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};

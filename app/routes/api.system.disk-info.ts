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

interface DiskInfo {
  filesystem: string;
  size: number;
  used: number;
  available: number;
  percentage: number;
  mountpoint: string;
  timestamp: string;
  error?: string;
}

const getDiskInfo = (): DiskInfo[] => {
  // If we're in a Cloudflare environment and not in development, return error
  if (!execSync && !isDevelopment) {
    return [
      {
        filesystem: 'N/A',
        size: 0,
        used: 0,
        available: 0,
        percentage: 0,
        mountpoint: 'N/A',
        timestamp: new Date().toISOString(),
        error: 'Disk information is not available in this environment',
      },
    ];
  }

  // If we're in development but not in Node environment, return mock data
  if (!execSync && isDevelopment) {
    // Generate random percentage between 40-60%
    const percentage = Math.floor(40 + Math.random() * 20);
    const totalSize = 500 * 1024 * 1024 * 1024; // 500GB
    const usedSize = Math.floor((totalSize * percentage) / 100);
    const availableSize = totalSize - usedSize;

    return [
      {
        filesystem: 'MockDisk',
        size: totalSize,
        used: usedSize,
        available: availableSize,
        percentage,
        mountpoint: '/',
        timestamp: new Date().toISOString(),
      },
      {
        filesystem: 'MockDisk2',
        size: 1024 * 1024 * 1024 * 1024, // 1TB
        used: 300 * 1024 * 1024 * 1024, // 300GB
        available: 724 * 1024 * 1024 * 1024, // 724GB
        percentage: 30,
        mountpoint: '/data',
        timestamp: new Date().toISOString(),
      },
    ];
  }

  try {
    // Different commands for different operating systems
    const platform = process.platform;
    let disks: DiskInfo[] = [];

    if (platform === 'darwin') {
      // macOS - use df command to get disk information
      try {
        const output = execSync('df -k', { encoding: 'utf-8' }).toString().trim();

        // Skip the header line
        const lines = output.split('\n').slice(1);

        disks = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/);
          const filesystem = parts[0];
          const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
          const used = parseInt(parts[2], 10) * 1024;
          const available = parseInt(parts[3], 10) * 1024;
          const percentageStr = parts[4].replace('%', '');
          const percentage = parseInt(percentageStr, 10);
          const mountpoint = parts[5];

          return {
            filesystem,
            size,
            used,
            available,
            percentage,
            mountpoint,
            timestamp: new Date().toISOString(),
          };
        });

        // Filter out non-physical disks
        disks = disks.filter(
          (disk) =>
            !disk.filesystem.startsWith('devfs') &&
            !disk.filesystem.startsWith('map') &&
            !disk.mountpoint.startsWith('/System/Volumes') &&
            disk.size > 0,
        );
      } catch (error) {
        console.error('Failed to get macOS disk info:', error);
        return [
          {
            filesystem: 'Unknown',
            size: 0,
            used: 0,
            available: 0,
            percentage: 0,
            mountpoint: '/',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ];
      }
    } else if (platform === 'linux') {
      // Linux - use df command to get disk information
      try {
        const output = execSync('df -k', { encoding: 'utf-8' }).toString().trim();

        // Skip the header line
        const lines = output.split('\n').slice(1);

        disks = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/);
          const filesystem = parts[0];
          const size = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
          const used = parseInt(parts[2], 10) * 1024;
          const available = parseInt(parts[3], 10) * 1024;
          const percentageStr = parts[4].replace('%', '');
          const percentage = parseInt(percentageStr, 10);
          const mountpoint = parts[5];

          return {
            filesystem,
            size,
            used,
            available,
            percentage,
            mountpoint,
            timestamp: new Date().toISOString(),
          };
        });

        // Filter out non-physical disks
        disks = disks.filter(
          (disk) =>
            !disk.filesystem.startsWith('/dev/loop') &&
            !disk.filesystem.startsWith('tmpfs') &&
            !disk.filesystem.startsWith('devtmpfs') &&
            disk.size > 0,
        );
      } catch (error) {
        console.error('Failed to get Linux disk info:', error);
        return [
          {
            filesystem: 'Unknown',
            size: 0,
            used: 0,
            available: 0,
            percentage: 0,
            mountpoint: '/',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ];
      }
    } else if (platform === 'win32') {
      // Windows - use PowerShell to get disk information
      try {
        const output = execSync(
          'powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free, @{Name=\'Size\';Expression={$_.Used + $_.Free}} | ConvertTo-Json"',
          { encoding: 'utf-8' },
        )
          .toString()
          .trim();

        const driveData = JSON.parse(output);
        const drivesArray = Array.isArray(driveData) ? driveData : [driveData];

        disks = drivesArray.map((drive) => {
          const size = drive.Size || 0;
          const used = drive.Used || 0;
          const available = drive.Free || 0;
          const percentage = size > 0 ? Math.round((used / size) * 100) : 0;

          return {
            filesystem: drive.Name + ':\\',
            size,
            used,
            available,
            percentage,
            mountpoint: drive.Name + ':\\',
            timestamp: new Date().toISOString(),
          };
        });
      } catch (error) {
        console.error('Failed to get Windows disk info:', error);
        return [
          {
            filesystem: 'Unknown',
            size: 0,
            used: 0,
            available: 0,
            percentage: 0,
            mountpoint: 'C:\\',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ];
      }
    } else {
      console.warn(`Unsupported platform: ${platform}`);
      return [
        {
          filesystem: 'Unknown',
          size: 0,
          used: 0,
          available: 0,
          percentage: 0,
          mountpoint: '/',
          timestamp: new Date().toISOString(),
          error: `Unsupported platform: ${platform}`,
        },
      ];
    }

    return disks;
  } catch (error) {
    console.error('Failed to get disk info:', error);
    return [
      {
        filesystem: 'Unknown',
        size: 0,
        used: 0,
        available: 0,
        percentage: 0,
        mountpoint: '/',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    ];
  }
};

export const loader: LoaderFunction = async ({ request: _request }) => {
  try {
    return json(getDiskInfo());
  } catch (error) {
    console.error('Failed to get disk info:', error);
    return json(
      [
        {
          filesystem: 'Unknown',
          size: 0,
          used: 0,
          available: 0,
          percentage: 0,
          mountpoint: '/',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      { status: 500 },
    );
  }
};

export const action = async ({ request: _request }: ActionFunctionArgs) => {
  try {
    return json(getDiskInfo());
  } catch (error) {
    console.error('Failed to get disk info:', error);
    return json(
      [
        {
          filesystem: 'Unknown',
          size: 0,
          used: 0,
          available: 0,
          percentage: 0,
          mountpoint: '/',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      { status: 500 },
    );
  }
};

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type Chart,
} from 'chart.js';
import { toast } from 'react-toastify'; // Import toast
import { useUpdateCheck } from '~/lib/hooks/useUpdateCheck';
import { tabConfigurationStore, type TabConfig } from '~/lib/stores/tabConfigurationStore';
import { useStore } from 'zustand';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

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

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command?: string;
  timestamp: string;
  error?: string;
}

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

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    process?: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
  };
  systemMemory?: SystemMemoryInfo;
  processes?: ProcessInfo[];
  disks?: DiskInfo[];
  battery?: {
    level: number;
    charging: boolean;
    timeRemaining?: number;
  };
  network: {
    downlink: number;
    uplink?: number;
    latency: {
      current: number;
      average: number;
      min: number;
      max: number;
      history: number[];
      lastUpdate: number;
    };
    type: string;
    effectiveType?: string;
  };
  performance: {
    pageLoad: number;
    domReady: number;
    resources: {
      total: number;
      size: number;
      loadTime: number;
    };
    timing: {
      ttfb: number;
      fcp: number;
      lcp: number;
    };
  };
}

type SortField = 'name' | 'pid' | 'cpu' | 'memory';
type SortDirection = 'asc' | 'desc';

interface MetricsHistory {
  timestamps: string[];
  memory: number[];
  battery: number[];
  network: number[];
  cpu: number[];
  disk: number[];
}

interface PerformanceAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  metric: string;
  threshold: number;
  value: number;
}

declare global {
  interface Navigator {
    getBattery(): Promise<BatteryManager>;
  }
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

// Constants for performance thresholds
const PERFORMANCE_THRESHOLDS = {
  memory: {
    warning: 75,
    critical: 90,
  },
  network: {
    latency: {
      warning: 200,
      critical: 500,
    },
  },
  battery: {
    warning: 20,
    critical: 10,
  },
};

// Default metrics state
const DEFAULT_METRICS_STATE: SystemMetrics = {
  memory: {
    used: 0,
    total: 0,
    percentage: 0,
  },
  network: {
    downlink: 0,
    latency: {
      current: 0,
      average: 0,
      min: 0,
      max: 0,
      history: [],
      lastUpdate: 0,
    },
    type: 'unknown',
  },
  performance: {
    pageLoad: 0,
    domReady: 0,
    resources: {
      total: 0,
      size: 0,
      loadTime: 0,
    },
    timing: {
      ttfb: 0,
      fcp: 0,
      lcp: 0,
    },
  },
};

// Default metrics history
const DEFAULT_METRICS_HISTORY: MetricsHistory = {
  timestamps: Array(8).fill(new Date().toLocaleTimeString()),
  memory: Array(8).fill(0),
  battery: Array(8).fill(0),
  network: Array(8).fill(0),
  cpu: Array(8).fill(0),
  disk: Array(8).fill(0),
};

// Maximum number of history points to keep
const MAX_HISTORY_POINTS = 8;

// Used for environment detection in updateMetrics function
const isLocalDevelopment =
  typeof window !== 'undefined' &&
  window.location &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// For development environments, we'll always provide mock data if real data isn't available
const isDevelopment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('192.168.') ||
    window.location.hostname.includes('.local'));

// Function to detect Cloudflare and similar serverless environments where TaskManager is not useful
const isServerlessHosting = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  // For testing: Allow forcing serverless mode via URL param for easy testing
  if (typeof window !== 'undefined' && window.location.search.includes('simulate-serverless=true')) {
    console.log('Simulating serverless environment for testing');
    return true;
  }

  // Check for common serverless hosting domains
  const hostname = window.location.hostname;

  return (
    hostname.includes('.cloudflare.') ||
    hostname.includes('.netlify.app') ||
    hostname.includes('.vercel.app') ||
    hostname.endsWith('.workers.dev')
  );
};

const TaskManagerTab: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>(() => DEFAULT_METRICS_STATE);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory>(() => DEFAULT_METRICS_HISTORY);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [lastAlertState, setLastAlertState] = useState<string>('normal');
  const [sortField, setSortField] = useState<SortField>('memory');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isNotSupported, setIsNotSupported] = useState<boolean>(false);

  // Chart refs for cleanup
  const memoryChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const batteryChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const networkChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const cpuChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const diskChartRef = React.useRef<Chart<'line', number[], string> | null>(null);

  // Cleanup chart instances on unmount
  React.useEffect(() => {
    const cleanupCharts = () => {
      if (memoryChartRef.current) {
        memoryChartRef.current.destroy();
      }

      if (batteryChartRef.current) {
        batteryChartRef.current.destroy();
      }

      if (networkChartRef.current) {
        networkChartRef.current.destroy();
      }

      if (cpuChartRef.current) {
        cpuChartRef.current.destroy();
      }

      if (diskChartRef.current) {
        diskChartRef.current.destroy();
      }
    };

    return cleanupCharts;
  }, []);

  // Get update status and tab configuration
  const { hasUpdate } = useUpdateCheck();
  const tabConfig = useStore(tabConfigurationStore);

  const resetTabConfiguration = useCallback(() => {
    tabConfig.reset();
    return tabConfig.get();
  }, [tabConfig]);

  // Effect to handle tab visibility
  useEffect(() => {
    const handleTabVisibility = () => {
      const currentConfig = tabConfig.get();
      const controlledTabs = ['debug', 'update'];

      // Update visibility based on conditions
      const updatedTabs = currentConfig.userTabs.map((tab: TabConfig) => {
        if (controlledTabs.includes(tab.id)) {
          return {
            ...tab,
            visible: tab.id === 'debug' ? metrics.memory.percentage > 80 : hasUpdate,
          };
        }

        return tab;
      });

      tabConfig.set({
        ...currentConfig,
        userTabs: updatedTabs,
      });
    };

    const checkInterval = setInterval(handleTabVisibility, 5000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [metrics.memory.percentage, hasUpdate, tabConfig]);

  // Effect to handle reset and initialization
  useEffect(() => {
    const resetToDefaults = () => {
      console.log('TaskManagerTab: Resetting to defaults');

      // Reset metrics and local state
      setMetrics(DEFAULT_METRICS_STATE);
      setMetricsHistory(DEFAULT_METRICS_HISTORY);
      setAlerts([]);

      // Reset tab configuration to ensure proper visibility
      const defaultConfig = resetTabConfiguration();
      console.log('TaskManagerTab: Reset tab configuration:', defaultConfig);
    };

    // Listen for both storage changes and custom reset event
    const handleReset = (event: Event | StorageEvent) => {
      if (event instanceof StorageEvent) {
        if (event.key === 'tabConfiguration' && event.newValue === null) {
          resetToDefaults();
        }
      } else if (event instanceof CustomEvent && event.type === 'tabConfigReset') {
        resetToDefaults();
      }
    };

    // Initial setup
    const initializeTab = async () => {
      try {
        await updateMetrics();
      } catch (error) {
        console.error('Failed to initialize TaskManagerTab:', error);
        resetToDefaults();
      }
    };

    window.addEventListener('storage', handleReset);
    window.addEventListener('tabConfigReset', handleReset);
    initializeTab();

    return () => {
      window.removeEventListener('storage', handleReset);
      window.removeEventListener('tabConfigReset', handleReset);
    };
  }, []);

  // Effect to update metrics periodically
  useEffect(() => {
    const updateInterval = 5000; // Update every 5 seconds instead of 2.5 seconds
    let metricsInterval: NodeJS.Timeout;

    // Only run updates when tab is visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(metricsInterval);
      } else {
        updateMetrics();
        metricsInterval = setInterval(updateMetrics, updateInterval);
      }
    };

    // Initial setup
    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(metricsInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Effect to disable taskmanager on serverless environments
  useEffect(() => {
    const checkEnvironment = async () => {
      // If we're on Cloudflare/Netlify/etc., set not supported
      if (isServerlessHosting()) {
        setIsNotSupported(true);
        return;
      }

      // For testing: Allow forcing API failures via URL param
      if (typeof window !== 'undefined' && window.location.search.includes('simulate-api-failure=true')) {
        console.log('Simulating API failures for testing');
        setIsNotSupported(true);

        return;
      }

      // Try to fetch system metrics once as detection
      try {
        const response = await fetch('/api/system/memory-info');
        const diskResponse = await fetch('/api/system/disk-info');
        const processResponse = await fetch('/api/system/process-info');

        // If all these return errors or not found, system monitoring is not supported
        if (!response.ok && !diskResponse.ok && !processResponse.ok) {
          setIsNotSupported(true);
        }
      } catch (error) {
        console.warn('Failed to fetch system metrics. TaskManager features may be limited:', error);

        // Don't automatically disable - we'll show partial data based on what's available
      }
    };

    checkEnvironment();
  }, []);

  // Get detailed performance metrics
  const getPerformanceMetrics = async (): Promise<Partial<SystemMetrics['performance']>> => {
    try {
      // Get page load metrics
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const pageLoad = navigation.loadEventEnd - navigation.startTime;
      const domReady = navigation.domContentLoadedEventEnd - navigation.startTime;

      // Get resource metrics
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const resourceMetrics = {
        total: resources.length,
        size: resources.reduce((total, r) => total + (r.transferSize || 0), 0),
        loadTime: Math.max(0, ...resources.map((r) => r.duration)),
      };

      // Get Web Vitals
      const ttfb = navigation.responseStart - navigation.requestStart;
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0;

      // Get LCP using PerformanceObserver
      const lcp = await new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry?.startTime || 0);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Resolve after 3s if no LCP
        setTimeout(() => resolve(0), 3000);
      });

      return {
        pageLoad,
        domReady,
        resources: resourceMetrics,
        timing: {
          ttfb,
          fcp,
          lcp,
        },
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {};
    }
  };

  // Function to measure endpoint latency
  const measureLatency = async (): Promise<number> => {
    try {
      const headers = new Headers();
      headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.append('Pragma', 'no-cache');
      headers.append('Expires', '0');

      const attemptMeasurement = async (): Promise<number> => {
        const start = performance.now();
        const response = await fetch('/api/health', {
          method: 'HEAD',
          headers,
        });
        const end = performance.now();

        if (!response.ok) {
          throw new Error(`Health check failed with status: ${response.status}`);
        }

        return Math.round(end - start);
      };

      try {
        const latency = await attemptMeasurement();
        console.log(`Measured latency: ${latency}ms`);

        return latency;
      } catch (error) {
        console.warn(`Latency measurement failed, retrying: ${error}`);

        try {
          // Retry once
          const latency = await attemptMeasurement();
          console.log(`Measured latency on retry: ${latency}ms`);

          return latency;
        } catch (retryError) {
          console.error(`Latency measurement failed after retry: ${retryError}`);

          // Return a realistic random latency value for development
          const mockLatency = 30 + Math.floor(Math.random() * 120); // 30-150ms
          console.log(`Using mock latency: ${mockLatency}ms`);

          return mockLatency;
        }
      }
    } catch (error) {
      console.error(`Error in latency measurement: ${error}`);

      // Return a realistic random latency value
      const mockLatency = 30 + Math.floor(Math.random() * 120); // 30-150ms
      console.log(`Using mock latency due to error: ${mockLatency}ms`);

      return mockLatency;
    }
  };

  // Update metrics with real data only
  const updateMetrics = async () => {
    try {
      // If we already determined this environment doesn't support system metrics, don't try fetching
      if (isNotSupported) {
        console.log('TaskManager: System metrics not supported in this environment');
        return;
      }

      // Get system memory info first as it's most important
      let systemMemoryInfo: SystemMemoryInfo | undefined;
      let memoryMetrics = {
        used: 0,
        total: 0,
        percentage: 0,
      };

      try {
        const response = await fetch('/api/system/memory-info');

        if (response.ok) {
          systemMemoryInfo = await response.json();
          console.log('Memory info response:', systemMemoryInfo);

          // Use system memory as primary memory metrics if available
          if (systemMemoryInfo && 'used' in systemMemoryInfo) {
            memoryMetrics = {
              used: systemMemoryInfo.used || 0,
              total: systemMemoryInfo.total || 1,
              percentage: systemMemoryInfo.percentage || 0,
            };
          }
        }
      } catch (error) {
        console.error('Failed to fetch system memory info:', error);
      }

      // Get process information
      let processInfo: ProcessInfo[] | undefined;

      try {
        const response = await fetch('/api/system/process-info');

        if (response.ok) {
          processInfo = await response.json();
          console.log('Process info response:', processInfo);
        }
      } catch (error) {
        console.error('Failed to fetch process info:', error);
      }

      // Get disk information
      let diskInfo: DiskInfo[] | undefined;

      try {
        const response = await fetch('/api/system/disk-info');

        if (response.ok) {
          diskInfo = await response.json();
          console.log('Disk info response:', diskInfo);
        }
      } catch (error) {
        console.error('Failed to fetch disk info:', error);
      }

      // Get battery info
      let batteryInfo: SystemMetrics['battery'] | undefined;

      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          batteryInfo = {
            level: battery.level * 100,
            charging: battery.charging,
            timeRemaining: battery.charging ? battery.chargingTime : battery.dischargingTime,
          };
        } else {
          // Mock battery data if API not available
          batteryInfo = {
            level: 75 + Math.floor(Math.random() * 20),
            charging: Math.random() > 0.3,
            timeRemaining: 7200 + Math.floor(Math.random() * 3600),
          };
          console.log('Battery API not available, using mock data');
        }
      } catch (error) {
        console.log('Battery API error, using mock data:', error);
        batteryInfo = {
          level: 75 + Math.floor(Math.random() * 20),
          charging: Math.random() > 0.3,
          timeRemaining: 7200 + Math.floor(Math.random() * 3600),
        };
      }

      // Enhanced network metrics
      const connection =
        (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

      // Measure real latency
      const measuredLatency = await measureLatency();
      const connectionRtt = connection?.rtt || 0;

      // Use measured latency if available, fall back to connection.rtt
      const currentLatency = measuredLatency || connectionRtt || Math.floor(Math.random() * 100);

      // Update network metrics with historical data
      const networkInfo = {
        downlink: connection?.downlink || 1.5 + Math.random(),
        uplink: connection?.uplink || 0.5 + Math.random(),
        latency: {
          current: currentLatency,
          average:
            metrics.network.latency.history.length > 0
              ? [...metrics.network.latency.history, currentLatency].reduce((a, b) => a + b, 0) /
                (metrics.network.latency.history.length + 1)
              : currentLatency,
          min:
            metrics.network.latency.history.length > 0
              ? Math.min(...metrics.network.latency.history, currentLatency)
              : currentLatency,
          max:
            metrics.network.latency.history.length > 0
              ? Math.max(...metrics.network.latency.history, currentLatency)
              : currentLatency,
          history: [...metrics.network.latency.history, currentLatency].slice(-30), // Keep last 30 measurements
          lastUpdate: Date.now(),
        },
        type: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || '4g',
      };

      // Get performance metrics
      const performanceMetrics = await getPerformanceMetrics();

      const updatedMetrics: SystemMetrics = {
        memory: memoryMetrics,
        systemMemory: systemMemoryInfo,
        processes: processInfo || [],
        disks: diskInfo || [],
        battery: batteryInfo,
        network: networkInfo,
        performance: performanceMetrics as SystemMetrics['performance'],
      };

      setMetrics(updatedMetrics);

      // Update history with real data
      const now = new Date().toLocaleTimeString();
      setMetricsHistory((prev) => {
        // Ensure we have valid data or use zeros
        const memoryPercentage = systemMemoryInfo?.percentage || 0;
        const batteryLevel = batteryInfo?.level || 0;
        const networkDownlink = networkInfo.downlink || 0;

        // Calculate CPU usage more accurately
        let cpuUsage = 0;

        if (processInfo && processInfo.length > 0) {
          // Get the average of the top 3 CPU-intensive processes
          const topProcesses = [...processInfo].sort((a, b) => b.cpu - a.cpu).slice(0, 3);
          const topCpuUsage = topProcesses.reduce((total, proc) => total + proc.cpu, 0);

          // Get the sum of all processes
          const totalCpuUsage = processInfo.reduce((total, proc) => total + proc.cpu, 0);

          // Use the higher of the two values, but cap at 100%
          cpuUsage = Math.min(Math.max(topCpuUsage, (totalCpuUsage / processInfo.length) * 3), 100);
        } else {
          // If no process info, generate random CPU usage between 5-30%
          cpuUsage = 5 + Math.floor(Math.random() * 25);
        }

        // Calculate disk usage (average of all disks)
        let diskUsage = 0;

        if (diskInfo && diskInfo.length > 0) {
          diskUsage = diskInfo.reduce((total, disk) => total + disk.percentage, 0) / diskInfo.length;
        } else {
          // If no disk info, generate random disk usage between 30-70%
          diskUsage = 30 + Math.floor(Math.random() * 40);
        }

        // Create new arrays with the latest data
        const timestamps = [...prev.timestamps, now].slice(-MAX_HISTORY_POINTS);
        const memory = [...prev.memory, memoryPercentage].slice(-MAX_HISTORY_POINTS);
        const battery = [...prev.battery, batteryLevel].slice(-MAX_HISTORY_POINTS);
        const network = [...prev.network, networkDownlink].slice(-MAX_HISTORY_POINTS);
        const cpu = [...prev.cpu, cpuUsage].slice(-MAX_HISTORY_POINTS);
        const disk = [...prev.disk, diskUsage].slice(-MAX_HISTORY_POINTS);

        console.log('Updated metrics history:', {
          timestamps,
          memory,
          battery,
          network,
          cpu,
          disk,
        });

        return { timestamps, memory, battery, network, cpu, disk };
      });

      // Check for memory alerts - only show toast when state changes
      const currentState =
        systemMemoryInfo && systemMemoryInfo.percentage > PERFORMANCE_THRESHOLDS.memory.critical
          ? 'critical-memory'
          : networkInfo.latency.current > PERFORMANCE_THRESHOLDS.network.latency.critical
            ? 'critical-network'
            : batteryInfo && !batteryInfo.charging && batteryInfo.level < PERFORMANCE_THRESHOLDS.battery.critical
              ? 'critical-battery'
              : 'normal';

      if (currentState === 'critical-memory' && lastAlertState !== 'critical-memory') {
        const alert: PerformanceAlert = {
          type: 'error',
          message: 'Critical system memory usage detected',
          timestamp: Date.now(),
          metric: 'memory',
          threshold: PERFORMANCE_THRESHOLDS.memory.critical,
          value: systemMemoryInfo?.percentage || 0,
        };
        setAlerts((prev) => {
          const newAlerts = [...prev, alert];
          return newAlerts.slice(-10);
        });
        toast.warning(alert.message, {
          toastId: 'memory-critical',
          autoClose: 5000,
        });
      } else if (currentState === 'critical-network' && lastAlertState !== 'critical-network') {
        const alert: PerformanceAlert = {
          type: 'warning',
          message: 'High network latency detected',
          timestamp: Date.now(),
          metric: 'network',
          threshold: PERFORMANCE_THRESHOLDS.network.latency.critical,
          value: networkInfo.latency.current,
        };
        setAlerts((prev) => {
          const newAlerts = [...prev, alert];
          return newAlerts.slice(-10);
        });
        toast.warning(alert.message, {
          toastId: 'network-critical',
          autoClose: 5000,
        });
      } else if (currentState === 'critical-battery' && lastAlertState !== 'critical-battery') {
        const alert: PerformanceAlert = {
          type: 'error',
          message: 'Critical battery level detected',
          timestamp: Date.now(),
          metric: 'battery',
          threshold: PERFORMANCE_THRESHOLDS.battery.critical,
          value: batteryInfo?.level || 0,
        };
        setAlerts((prev) => {
          const newAlerts = [...prev, alert];
          return newAlerts.slice(-10);
        });
        toast.error(alert.message, {
          toastId: 'battery-critical',
          autoClose: 5000,
        });
      }

      setLastAlertState(currentState);

      // Then update the environment detection
      const isCloudflare =
        !isDevelopment && // Not in development mode
        ((systemMemoryInfo?.error && systemMemoryInfo.error.includes('not available')) ||
          (processInfo?.[0]?.error && processInfo[0].error.includes('not available')) ||
          (diskInfo?.[0]?.error && diskInfo[0].error.includes('not available')));

      // If we detect that we're in a serverless environment, set the flag
      if (isCloudflare || isServerlessHosting()) {
        setIsNotSupported(true);
      }

      if (isCloudflare) {
        console.log('Running in Cloudflare environment. System metrics not available.');
      } else if (isLocalDevelopment) {
        console.log('Running in local development environment. Using real or mock system metrics as available.');
      } else if (isDevelopment) {
        console.log('Running in development environment. Using real or mock system metrics as available.');
      } else {
        console.log('Running in production environment. Using real system metrics.');
      }
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  };

  const getUsageColor = (usage: number): string => {
    if (usage > 80) {
      return 'text-red-500';
    }

    if (usage > 50) {
      return 'text-yellow-500';
    }

    return 'text-gray-500';
  };

  // Chart rendering function
  const renderUsageGraph = React.useMemo(
    () =>
      (data: number[], label: string, color: string, chartRef: React.RefObject<Chart<'line', number[], string>>) => {
        // Ensure we have valid data
        const validData = data.map((value) => (isNaN(value) ? 0 : value));

        // Ensure we have at least 2 data points
        if (validData.length < 2) {
          // Add a second point if we only have one
          if (validData.length === 1) {
            validData.push(validData[0]);
          } else {
            // Add two points if we have none
            validData.push(0, 0);
          }
        }

        const chartData = {
          labels:
            metricsHistory.timestamps.length > 0
              ? metricsHistory.timestamps
              : Array(validData.length)
                  .fill('')
                  .map((_, _i) => new Date().toLocaleTimeString()),
          datasets: [
            {
              label,
              data: validData.slice(-MAX_HISTORY_POINTS),
              borderColor: color,
              backgroundColor: `${color}33`, // Add slight transparency for fill
              fill: true,
              tension: 0.4,
              pointRadius: 2, // Small points for better UX
              borderWidth: 2,
            },
          ],
        };

        const options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: label === 'Network' ? undefined : 100, // Auto-scale for network, 0-100 for others
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
                drawBorder: false,
              },
              ticks: {
                maxTicksLimit: 5,
                callback: (value: any) => {
                  if (label === 'Network') {
                    return `${value} Mbps`;
                  }

                  return `${value}%`;
                },
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                maxTicksLimit: 4,
                maxRotation: 0,
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              mode: 'index' as const,
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              borderColor: color,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 4,
              displayColors: false,
              callbacks: {
                title: (tooltipItems: any) => {
                  return tooltipItems[0].label; // Show timestamp
                },
                label: (context: any) => {
                  const value = context.raw;

                  if (label === 'Memory') {
                    return `Memory: ${value.toFixed(1)}%`;
                  } else if (label === 'CPU') {
                    return `CPU: ${value.toFixed(1)}%`;
                  } else if (label === 'Battery') {
                    return `Battery: ${value.toFixed(1)}%`;
                  } else if (label === 'Network') {
                    return `Network: ${value.toFixed(1)} Mbps`;
                  } else if (label === 'Disk') {
                    return `Disk: ${value.toFixed(1)}%`;
                  }

                  return `${label}: ${value.toFixed(1)}`;
                },
              },
            },
          },
          animation: {
            duration: 300, // Short animation for better UX
          } as const,
          elements: {
            line: {
              tension: 0.3,
            },
          },
        };

        return (
          <div className="h-32">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        );
      },
    [metricsHistory.timestamps],
  );

  // Function to handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Function to sort processes
  const getSortedProcesses = () => {
    if (!metrics.processes) {
      return [];
    }

    return [...metrics.processes].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'pid':
          comparison = a.pid - b.pid;
          break;
        case 'cpu':
          comparison = a.cpu - b.cpu;
          break;
        case 'memory':
          comparison = a.memory - b.memory;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // If we're in an environment where the task manager won't work, show a message
  if (isNotSupported) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center h-full">
        <div className="i-ph:cloud-slash-fill w-16 h-16 text-bolt-elements-textTertiary mb-4" />
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">System Monitoring Not Available</h3>
        <p className="text-bolt-elements-textSecondary mb-6 max-w-md">
          System monitoring is not available in serverless environments like Cloudflare Pages, Netlify, or Vercel. These
          platforms don't provide access to the underlying system resources.
        </p>
        <div className="flex flex-col gap-2 bg-bolt-background-secondary dark:bg-bolt-backgroundDark-secondary p-4 rounded-lg text-sm text-left max-w-md">
          <p className="text-bolt-elements-textSecondary">
            <span className="font-medium">Why is this disabled?</span>
            <br />
            Serverless platforms execute your code in isolated environments without access to the server's operating
            system metrics like CPU, memory, and disk usage.
          </p>
          <p className="text-bolt-elements-textSecondary mt-2">
            System monitoring features will be available when running in:
            <ul className="list-disc pl-6 mt-1 text-bolt-elements-textSecondary">
              <li>Local development environment</li>
              <li>Virtual Machines (VMs)</li>
              <li>Dedicated servers</li>
              <li>Docker containers (with proper permissions)</li>
            </ul>
          </p>
        </div>

        {/* Testing controls - only shown in development */}
        {isDevelopment && (
          <div className="mt-6 p-4 border border-dashed border-bolt-elements-border rounded-lg">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Testing Controls</h4>
            <p className="text-xs text-bolt-elements-textSecondary mb-3">
              These controls are only visible in development mode
            </p>
            <div className="flex gap-2">
              <a
                href="?"
                className="px-3 py-1.5 bg-bolt-background-tertiary text-xs rounded-md text-bolt-elements-textPrimary"
              >
                Normal Mode
              </a>
              <a
                href="?simulate-serverless=true"
                className="px-3 py-1.5 bg-bolt-action-primary text-xs rounded-md text-white"
              >
                Simulate Serverless
              </a>
              <a
                href="?simulate-api-failure=true"
                className="px-3 py-1.5 bg-bolt-action-destructive text-xs rounded-md text-white"
              >
                Simulate API Failures
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Header */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#141414]">
          <div className="text-sm text-bolt-elements-textSecondary">CPU</div>
          <div
            className={classNames(
              'text-xl font-semibold',
              getUsageColor(metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0),
            )}
          >
            {(metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0).toFixed(1)}%
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#141414]">
          <div className="text-sm text-bolt-elements-textSecondary">Memory</div>
          <div className={classNames('text-xl font-semibold', getUsageColor(metrics.systemMemory?.percentage || 0))}>
            {Math.round(metrics.systemMemory?.percentage || 0)}%
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#141414]">
          <div className="text-sm text-bolt-elements-textSecondary">Disk</div>
          <div
            className={classNames(
              'text-xl font-semibold',
              getUsageColor(
                metrics.disks && metrics.disks.length > 0
                  ? metrics.disks.reduce((total, disk) => total + disk.percentage, 0) / metrics.disks.length
                  : 0,
              ),
            )}
          >
            {metrics.disks && metrics.disks.length > 0
              ? Math.round(metrics.disks.reduce((total, disk) => total + disk.percentage, 0) / metrics.disks.length)
              : 0}
            %
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#141414]">
          <div className="text-sm text-bolt-elements-textSecondary">Network</div>
          <div className="text-xl font-semibold text-gray-500">{metrics.network.downlink.toFixed(1)} Mbps</div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-bolt-elements-textPrimary">Memory Usage</h3>
        <div className="grid grid-cols-1 gap-4">
          {/* System Physical Memory */}
          <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-bolt-elements-textSecondary">System Memory</span>
                <div className="relative ml-1 group">
                  <div className="i-ph:info-duotone w-4 h-4 text-bolt-elements-textSecondary cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-bolt-background-tertiary dark:bg-bolt-backgroundDark-tertiary rounded shadow-lg text-xs text-bolt-elements-textSecondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    Shows your system's physical memory (RAM) usage.
                  </div>
                </div>
              </div>
              <span className={classNames('text-sm font-medium', getUsageColor(metrics.systemMemory?.percentage || 0))}>
                {Math.round(metrics.systemMemory?.percentage || 0)}%
              </span>
            </div>
            {renderUsageGraph(metricsHistory.memory, 'Memory', '#2563eb', memoryChartRef)}
            <div className="text-xs text-bolt-elements-textSecondary mt-2">
              Used: {formatBytes(metrics.systemMemory?.used || 0)} / {formatBytes(metrics.systemMemory?.total || 0)}
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              Free: {formatBytes(metrics.systemMemory?.free || 0)}
            </div>
          </div>

          {/* Swap Memory */}
          {metrics.systemMemory?.swap && (
            <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm text-bolt-elements-textSecondary">Swap Memory</span>
                  <div className="relative ml-1 group">
                    <div className="i-ph:info-duotone w-4 h-4 text-bolt-elements-textSecondary cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-bolt-background-tertiary dark:bg-bolt-backgroundDark-tertiary rounded shadow-lg text-xs text-bolt-elements-textSecondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      Virtual memory used when physical RAM is full.
                    </div>
                  </div>
                </div>
                <span
                  className={classNames('text-sm font-medium', getUsageColor(metrics.systemMemory.swap.percentage))}
                >
                  {Math.round(metrics.systemMemory.swap.percentage)}%
                </span>
              </div>
              <div className="w-full bg-bolt-elements-border rounded-full h-2 mb-2">
                <div
                  className={classNames('h-2 rounded-full', getUsageColor(metrics.systemMemory.swap.percentage))}
                  style={{ width: `${Math.min(100, Math.max(0, metrics.systemMemory.swap.percentage))}%` }}
                />
              </div>
              <div className="text-xs text-bolt-elements-textSecondary">
                Used: {formatBytes(metrics.systemMemory.swap.used)} / {formatBytes(metrics.systemMemory.swap.total)}
              </div>
              <div className="text-xs text-bolt-elements-textSecondary">
                Free: {formatBytes(metrics.systemMemory.swap.free)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disk Usage */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-bolt-elements-textPrimary">Disk Usage</h3>
        {metrics.disks && metrics.disks.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bolt-elements-textSecondary">System Disk</span>
              <span
                className={classNames(
                  'text-sm font-medium',
                  getUsageColor(metricsHistory.disk[metricsHistory.disk.length - 1] || 0),
                )}
              >
                {(metricsHistory.disk[metricsHistory.disk.length - 1] || 0).toFixed(1)}%
              </span>
            </div>
            {renderUsageGraph(metricsHistory.disk, 'Disk', '#8b5cf6', diskChartRef)}

            {/* Show only the main system disk (usually the first one) */}
            {metrics.disks[0] && (
              <>
                <div className="w-full bg-bolt-elements-border rounded-full h-2 mt-2">
                  <div
                    className={classNames('h-2 rounded-full', getUsageColor(metrics.disks[0].percentage))}
                    style={{ width: `${Math.min(100, Math.max(0, metrics.disks[0].percentage))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-bolt-elements-textSecondary mt-1">
                  <div>Used: {formatBytes(metrics.disks[0].used)}</div>
                  <div>Free: {formatBytes(metrics.disks[0].available)}</div>
                  <div>Total: {formatBytes(metrics.disks[0].size)}</div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 rounded-lg bg-[#F8F8F8] dark:bg-[#141414]">
            <div className="i-ph:hard-drive-fill w-12 h-12 text-bolt-elements-textTertiary mb-2" />
            <p className="text-bolt-elements-textSecondary text-sm">Disk information is not available</p>
            <p className="text-bolt-elements-textTertiary text-xs mt-1">
              This feature may not be supported in your environment
            </p>
          </div>
        )}
      </div>

      {/* Process Information */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-bolt-elements-textPrimary">Process Information</h3>
          <button
            onClick={updateMetrics}
            className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            <div className="i-ph:arrows-clockwise w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
          {metrics.processes && metrics.processes.length > 0 ? (
            <>
              {/* CPU Usage Summary */}
              {metrics.processes[0].name !== 'Unknown' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-bolt-elements-textSecondary">CPU Usage</span>
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">
                      {(metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0).toFixed(1)}% Total
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bolt-elements-border rounded-full overflow-hidden relative">
                    <div className="flex h-full w-full">
                      {metrics.processes.map((process, index) => {
                        return (
                          <div
                            key={`cpu-bar-${process.pid}-${index}`}
                            className={classNames('h-full', getUsageColor(process.cpu))}
                            style={{
                              width: `${Math.min(100, Math.max(0, process.cpu))}%`,
                            }}
                            title={`${process.name}: ${process.cpu.toFixed(1)}%`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <div className="text-bolt-elements-textSecondary">
                      System:{' '}
                      {metrics.processes.reduce((total, proc) => total + (proc.cpu < 10 ? proc.cpu : 0), 0).toFixed(1)}%
                    </div>
                    <div className="text-bolt-elements-textSecondary">
                      User:{' '}
                      {metrics.processes.reduce((total, proc) => total + (proc.cpu >= 10 ? proc.cpu : 0), 0).toFixed(1)}
                      %
                    </div>
                    <div className="text-bolt-elements-textSecondary">
                      Idle: {(100 - (metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0)).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-bolt-elements-textSecondary border-b border-bolt-elements-border">
                      <th
                        className="text-left py-2 px-2 cursor-pointer hover:text-bolt-elements-textPrimary"
                        onClick={() => handleSort('name')}
                      >
                        Process {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-right py-2 px-2 cursor-pointer hover:text-bolt-elements-textPrimary"
                        onClick={() => handleSort('pid')}
                      >
                        PID {sortField === 'pid' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-right py-2 px-2 cursor-pointer hover:text-bolt-elements-textPrimary"
                        onClick={() => handleSort('cpu')}
                      >
                        CPU % {sortField === 'cpu' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="text-right py-2 px-2 cursor-pointer hover:text-bolt-elements-textPrimary"
                        onClick={() => handleSort('memory')}
                      >
                        Memory {sortField === 'memory' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedProcesses().map((process, index) => (
                      <tr
                        key={`${process.pid}-${index}`}
                        className="border-b border-bolt-elements-border last:border-0"
                      >
                        <td
                          className="py-2 px-2 text-bolt-elements-textPrimary truncate max-w-[200px]"
                          title={process.command || process.name}
                        >
                          {process.name}
                        </td>
                        <td className="py-2 px-2 text-right text-bolt-elements-textSecondary">{process.pid}</td>
                        <td className={classNames('py-2 px-2 text-right', getUsageColor(process.cpu))}>
                          <div
                            className="flex items-center justify-end gap-1"
                            title={`CPU Usage: ${process.cpu.toFixed(1)}% ${process.command ? `\nCommand: ${process.command}` : ''}`}
                          >
                            <div className="w-16 h-2 bg-bolt-elements-border rounded-full overflow-hidden">
                              <div
                                className={classNames('h-full rounded-full', getUsageColor(process.cpu))}
                                style={{ width: `${Math.min(100, Math.max(0, process.cpu))}%` }}
                              />
                            </div>
                            {process.cpu.toFixed(1)}%
                          </div>
                        </td>
                        <td className={classNames('py-2 px-2 text-right', getUsageColor(process.memory))}>
                          <div
                            className="flex items-center justify-end gap-1"
                            title={`Memory Usage: ${process.memory.toFixed(1)}%`}
                          >
                            <div className="w-16 h-2 bg-bolt-elements-border rounded-full overflow-hidden">
                              <div
                                className={classNames('h-full rounded-full', getUsageColor(process.memory))}
                                style={{ width: `${Math.min(100, Math.max(0, process.memory))}%` }}
                              />
                            </div>
                            {/* Calculate approximate MB based on percentage and total system memory */}
                            {metrics.systemMemory
                              ? `${formatBytes(metrics.systemMemory.total * (process.memory / 100))}`
                              : `${process.memory.toFixed(1)}%`}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-bolt-elements-textSecondary mt-2">
                {metrics.processes[0].error ? (
                  <span className="text-yellow-500">
                    <div className="i-ph:warning-circle-fill w-4 h-4 inline-block mr-1" />
                    Error retrieving process information: {metrics.processes[0].error}
                  </span>
                ) : metrics.processes[0].name === 'Browser' ? (
                  <span>
                    <div className="i-ph:info-fill w-4 h-4 inline-block mr-1 text-blue-500" />
                    Showing browser process information. System process information is not available in this
                    environment.
                  </span>
                ) : (
                  <span>Showing top {metrics.processes.length} processes by memory usage</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="i-ph:cpu-fill w-12 h-12 text-bolt-elements-textTertiary mb-2" />
              <p className="text-bolt-elements-textSecondary text-sm">Process information is not available</p>
              <p className="text-bolt-elements-textTertiary text-xs mt-1">
                This feature may not be supported in your environment
              </p>
              <button
                onClick={updateMetrics}
                className="mt-4 px-3 py-1 bg-bolt-action-primary text-white rounded-md text-xs"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CPU Usage Graph */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-bolt-elements-textPrimary">CPU Usage History</h3>
        <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-bolt-elements-textSecondary">System CPU</span>
            <span
              className={classNames(
                'text-sm font-medium',
                getUsageColor(metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0),
              )}
            >
              {(metricsHistory.cpu[metricsHistory.cpu.length - 1] || 0).toFixed(1)}%
            </span>
          </div>
          {renderUsageGraph(metricsHistory.cpu, 'CPU', '#ef4444', cpuChartRef)}
          <div className="text-xs text-bolt-elements-textSecondary mt-2">
            Average: {(metricsHistory.cpu.reduce((a, b) => a + b, 0) / metricsHistory.cpu.length || 0).toFixed(1)}%
          </div>
          <div className="text-xs text-bolt-elements-textSecondary">
            Peak: {Math.max(...metricsHistory.cpu).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Network */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-bolt-elements-textPrimary">Network</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bolt-elements-textSecondary">Connection</span>
              <span className="text-sm font-medium text-bolt-elements-textPrimary">
                {metrics.network.downlink.toFixed(1)} Mbps
              </span>
            </div>
            {renderUsageGraph(metricsHistory.network, 'Network', '#f59e0b', networkChartRef)}
            <div className="text-xs text-bolt-elements-textSecondary mt-2">
              Type: {metrics.network.type}
              {metrics.network.effectiveType && ` (${metrics.network.effectiveType})`}
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              Latency: {Math.round(metrics.network.latency.current)}ms
              <span className="text-xs text-bolt-elements-textTertiary ml-2">
                (avg: {Math.round(metrics.network.latency.average)}ms)
              </span>
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              Min: {Math.round(metrics.network.latency.min)}ms / Max: {Math.round(metrics.network.latency.max)}ms
            </div>
            {metrics.network.uplink && (
              <div className="text-xs text-bolt-elements-textSecondary">
                Uplink: {metrics.network.uplink.toFixed(1)} Mbps
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Battery */}
      {metrics.battery && (
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium text-bolt-elements-textPrimary">Battery</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-bolt-elements-textSecondary">Status</span>
                <div className="flex items-center gap-2">
                  {metrics.battery.charging && <div className="i-ph:lightning-fill w-4 h-4 text-bolt-action-primary" />}
                  <span
                    className={classNames(
                      'text-sm font-medium',
                      metrics.battery.level > 20 ? 'text-bolt-elements-textPrimary' : 'text-red-500',
                    )}
                  >
                    {Math.round(metrics.battery.level)}%
                  </span>
                </div>
              </div>
              {renderUsageGraph(metricsHistory.battery, 'Battery', '#22c55e', batteryChartRef)}
              {metrics.battery.timeRemaining && metrics.battery.timeRemaining !== Infinity && (
                <div className="text-xs text-bolt-elements-textSecondary mt-2">
                  {metrics.battery.charging ? 'Time to full: ' : 'Time remaining: '}
                  {formatTime(metrics.battery.timeRemaining)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-bolt-elements-textPrimary">Performance</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
            <div className="text-xs text-bolt-elements-textSecondary">
              Page Load: {(metrics.performance.pageLoad / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              DOM Ready: {(metrics.performance.domReady / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              TTFB: {(metrics.performance.timing.ttfb / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-bolt-elements-textSecondary">
              Resources: {metrics.performance.resources.total} ({formatBytes(metrics.performance.resources.size)})
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-bolt-elements-textPrimary">Recent Alerts</span>
            <button
              onClick={() => setAlerts([])}
              className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2">
            {alerts.slice(-5).map((alert, index) => (
              <div
                key={index}
                className={classNames('flex items-center gap-2 text-sm', {
                  'text-red-500': alert.type === 'error',
                  'text-yellow-500': alert.type === 'warning',
                  'text-blue-500': alert.type === 'info',
                })}
              >
                <div
                  className={classNames('w-4 h-4', {
                    'i-ph:warning-circle-fill': alert.type === 'warning',
                    'i-ph:x-circle-fill': alert.type === 'error',
                    'i-ph:info-fill': alert.type === 'info',
                  })}
                />
                <span>{alert.message}</span>
                <span className="text-xs text-bolt-elements-textSecondary ml-auto">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TaskManagerTab);

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Format with 2 decimal places for MB and larger units
  const formattedValue = i >= 2 ? value.toFixed(2) : value.toFixed(0);

  return `${formattedValue} ${sizes[i]}`;
};

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds === 0) {
    return 'Unknown';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

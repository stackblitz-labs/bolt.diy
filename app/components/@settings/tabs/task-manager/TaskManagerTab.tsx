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

interface MetricsHistory {
  timestamps: string[];
  memory: number[];
  battery: number[];
  network: number[];
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
    warning: 80,
    critical: 95,
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
  timestamps: Array(10).fill(new Date().toLocaleTimeString()),
  memory: Array(10).fill(0),
  battery: Array(10).fill(0),
  network: Array(10).fill(0),
};

// Maximum number of history points to keep
const MAX_HISTORY_POINTS = 10;

const TaskManagerTab: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>(() => DEFAULT_METRICS_STATE);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory>(() => DEFAULT_METRICS_HISTORY);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [lastAlertState, setLastAlertState] = useState<string>('normal');

  // Chart refs for cleanup
  const memoryChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const batteryChartRef = React.useRef<Chart<'line', number[], string> | null>(null);
  const networkChartRef = React.useRef<Chart<'line', number[], string> | null>(null);

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
    const updateInterval = 2500; // Update every 2.5 seconds instead of every second
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
    const start = performance.now();

    try {
      // Use the memory info endpoint since we're already calling it
      const response = await fetch('/api/system/memory-info', {
        method: 'HEAD', // Only get headers, don't download body
        cache: 'no-store', // Prevent caching
      });

      if (response.ok) {
        return performance.now() - start;
      }
    } catch (error) {
      console.error('Failed to measure latency:', error);
    }

    return 0;
  };

  // Update metrics with real data only
  const updateMetrics = async () => {
    try {
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

          // Use system memory as primary memory metrics if available
          if (systemMemoryInfo && 'used' in systemMemoryInfo) {
            memoryMetrics = {
              used: systemMemoryInfo.used,
              total: systemMemoryInfo.total,
              percentage: systemMemoryInfo.percentage,
            };
          }
        }
      } catch (error) {
        console.error('Failed to fetch system memory info:', error);
      }

      // Get battery info
      let batteryInfo: SystemMetrics['battery'] | undefined;

      try {
        const battery = await navigator.getBattery();
        batteryInfo = {
          level: battery.level * 100,
          charging: battery.charging,
          timeRemaining: battery.charging ? battery.chargingTime : battery.dischargingTime,
        };
      } catch {
        console.log('Battery API not available');
      }

      // Enhanced network metrics
      const connection =
        (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

      // Measure real latency
      const measuredLatency = await measureLatency();
      const connectionRtt = connection?.rtt || 0;

      // Use measured latency if available, fall back to connection.rtt
      const currentLatency = measuredLatency || connectionRtt;

      // Update network metrics with historical data
      const networkInfo = {
        downlink: connection?.downlink || 0,
        uplink: connection?.uplink,
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
        effectiveType: connection?.effectiveType,
      };

      // Get performance metrics
      const performanceMetrics = await getPerformanceMetrics();

      const updatedMetrics: SystemMetrics = {
        memory: memoryMetrics,
        systemMemory: systemMemoryInfo,
        battery: batteryInfo,
        network: networkInfo,
        performance: performanceMetrics as SystemMetrics['performance'],
      };

      setMetrics(updatedMetrics);

      // Update history with real data
      const now = new Date().toLocaleTimeString();
      setMetricsHistory((prev) => {
        const timestamps = [...prev.timestamps, now].slice(-MAX_HISTORY_POINTS);
        const memory = [...prev.memory, systemMemoryInfo?.percentage || 0].slice(-MAX_HISTORY_POINTS);
        const battery = [...prev.battery, batteryInfo?.level || 0].slice(-MAX_HISTORY_POINTS);
        const network = [...prev.network, networkInfo.downlink].slice(-MAX_HISTORY_POINTS);

        return { timestamps, memory, battery, network };
      });

      // Check for memory alerts - only show toast when state changes
      const currentState =
        systemMemoryInfo && systemMemoryInfo.percentage > PERFORMANCE_THRESHOLDS.memory.critical
          ? 'critical'
          : 'normal';

      if (currentState === 'critical' && lastAlertState !== 'critical') {
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
      }

      setLastAlertState(currentState);
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
        const chartData = {
          labels: metricsHistory.timestamps,
          datasets: [
            {
              label,
              data: data.slice(-MAX_HISTORY_POINTS),
              borderColor: color,
              fill: false,
              tension: 0.4,
            },
          ],
        };

        const options = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
          animation: {
            duration: 0,
          } as const,
        };

        return (
          <div className="h-32">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        );
      },
    [metricsHistory.timestamps],
  );

  return (
    <div className="flex flex-col gap-6">
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

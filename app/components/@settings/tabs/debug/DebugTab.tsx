import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { logStore, type LogEntry } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { Progress } from '~/components/ui/Progress';
import { ScrollArea } from '~/components/ui/ScrollArea';
import { Badge } from '~/components/ui/Badge';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { jsPDF } from 'jspdf';
import { useSettings } from '~/lib/hooks/useSettings';

interface SystemInfo {
  os: string;
  arch: string;
  platform: string;
  cpus: string;
  memory: {
    total: string;
    free: string;
    used: string;
    percentage: number;
  };
  node: string;
  browser: {
    name: string;
    version: string;
    language: string;
    userAgent: string;
    cookiesEnabled: boolean;
    online: boolean;
    platform: string;
    cores: number;
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  time: {
    timezone: string;
    offset: number;
    locale: string;
  };
  performance: {
    memory: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
      usagePercentage: number;
    };
    timing: {
      loadTime: number;
      domReadyTime: number;
      readyStart: number;
      redirectTime: number;
      appcacheTime: number;
      unloadEventTime: number;
      lookupDomainTime: number;
      connectTime: number;
      requestTime: number;
      initDomTreeTime: number;
      loadEventTime: number;
    };
    navigation: {
      type: number;
      redirectCount: number;
    };
  };
  network: {
    downlink: number;
    effectiveType: string;
    rtt: number;
    saveData: boolean;
    type: string;
  };
  battery?: {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
  };
  storage: {
    quota: number;
    usage: number;
    persistent: boolean;
    temporary: boolean;
  };
}

interface GitHubRepoInfo {
  fullName: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues?: number;
}

interface GitInfo {
  local: {
    commitHash: string;
    branch: string;
    commitTime: string;
    author: string;
    email: string;
    remoteUrl: string;
    repoName: string;
  };
  github?: {
    currentRepo: GitHubRepoInfo;
    upstream?: GitHubRepoInfo;
  };
  isForked?: boolean;
}

interface WebAppInfo {
  name: string;
  version: string;
  description: string;
  license: string;
  environment: string;
  timestamp: string;
  runtimeInfo: {
    nodeVersion: string;
  };
  dependencies: {
    production: Array<{ name: string; version: string; type: string }>;
    development: Array<{ name: string; version: string; type: string }>;
    peer: Array<{ name: string; version: string; type: string }>;
    optional: Array<{ name: string; version: string; type: string }>;
  };
  gitInfo: GitInfo;
}

// Add Ollama service status interface
interface OllamaServiceStatus {
  isRunning: boolean;
  lastChecked: Date;
  error?: string;
  models?: Array<{
    name: string;
    size: string;
    quantization: string;
  }>;
}

interface ExportFormat {
  id: string;
  label: string;
  icon: string;
  handler: () => void;
}

const DependencySection = ({
  title,
  deps,
}: {
  title: string;
  deps: Array<{ name: string; version: string; type: string }>;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (deps.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={classNames(
          'flex w-full items-center justify-between p-4',
          'bg-white dark:bg-[#0A0A0A]',
          'hover:bg-purple-50/50 dark:hover:bg-[#1a1a1a]',
          'border-b border-[#E5E5E5] dark:border-[#1A1A1A]',
          'transition-colors duration-200',
          'first:rounded-t-lg last:rounded-b-lg',
          { 'hover:rounded-lg': !isOpen },
        )}
      >
        <div className="flex items-center gap-3">
          <div className="i-ph:package text-bolt-elements-textSecondary w-4 h-4" />
          <span className="text-base text-bolt-elements-textPrimary">
            {title} Dependencies ({deps.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-bolt-elements-textSecondary">{isOpen ? 'Hide' : 'Show'}</span>
          <div
            className={classNames(
              'i-ph:caret-down w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
              isOpen ? 'rotate-180' : '',
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea
          className={classNames(
            'h-[200px] w-full',
            'bg-white dark:bg-[#0A0A0A]',
            'border-b border-[#E5E5E5] dark:border-[#1A1A1A]',
            'last:rounded-b-lg last:border-b-0',
          )}
        >
          <div className="space-y-2 p-4">
            {deps.map((dep) => (
              <div key={dep.name} className="flex items-center justify-between text-sm">
                <span className="text-bolt-elements-textPrimary">{dep.name}</span>
                <span className="text-bolt-elements-textSecondary">{dep.version}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function DebugTab() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [webAppInfo, setWebAppInfo] = useState<WebAppInfo | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaServiceStatus>({
    isRunning: false,
    lastChecked: new Date(),
  });
  const [loading, setLoading] = useState({
    systemInfo: false,
    webAppInfo: false,
    errors: false,
    performance: false,
  });
  const [openSections, setOpenSections] = useState({
    system: false,
    webapp: false,
    errors: false,
    performance: false,
  });

  const { providers } = useSettings();

  // Subscribe to logStore updates
  const logs = useStore(logStore.logs);
  const errorLogs = useMemo(() => {
    return Object.values(logs).filter(
      (log): log is LogEntry => typeof log === 'object' && log !== null && 'level' in log && log.level === 'error',
    );
  }, [logs]);

  // Set up error listeners when component mounts
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logStore.logError(event.message, event.error, {
        filename: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logStore.logError('Unhandled Promise Rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Check for errors when the errors section is opened
  useEffect(() => {
    if (openSections.errors) {
      checkErrors();
    }
  }, [openSections.errors]);

  // Load initial data when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([getSystemInfo(), getWebAppInfo()]);
    };

    loadInitialData();
  }, []);

  // Refresh data when sections are opened
  useEffect(() => {
    if (openSections.system) {
      getSystemInfo();
    }

    if (openSections.webapp) {
      getWebAppInfo();
    }
  }, [openSections.system, openSections.webapp]);

  // Add periodic refresh of git info
  useEffect(() => {
    if (!openSections.webapp) {
      return undefined;
    }

    // Initial fetch
    const fetchGitInfo = async () => {
      try {
        const response = await fetch('/api/system/git-info');
        const updatedGitInfo = (await response.json()) as GitInfo;

        setWebAppInfo((prev) => {
          if (!prev) {
            return null;
          }

          // Only update if the data has changed
          if (JSON.stringify(prev.gitInfo) === JSON.stringify(updatedGitInfo)) {
            return prev;
          }

          return {
            ...prev,
            gitInfo: updatedGitInfo,
          };
        });
      } catch (error) {
        console.error('Failed to fetch git info:', error);
      }
    };

    fetchGitInfo();

    // Refresh every 5 minutes instead of every second
    const interval = setInterval(fetchGitInfo, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [openSections.webapp]);

  const getSystemInfo = async () => {
    try {
      setLoading((prev) => ({ ...prev, systemInfo: true }));

      // Get better OS detection
      const userAgent = navigator.userAgent;
      let detectedOS = 'Unknown';
      let detectedArch = 'unknown';

      // Improved OS detection
      if (userAgent.indexOf('Win') !== -1) {
        detectedOS = 'Windows';
      } else if (userAgent.indexOf('Mac') !== -1) {
        detectedOS = 'macOS';
      } else if (userAgent.indexOf('Linux') !== -1) {
        detectedOS = 'Linux';
      } else if (userAgent.indexOf('Android') !== -1) {
        detectedOS = 'Android';
      } else if (/iPhone|iPad|iPod/.test(userAgent)) {
        detectedOS = 'iOS';
      }

      // Better architecture detection
      if (userAgent.indexOf('x86_64') !== -1 || userAgent.indexOf('x64') !== -1 || userAgent.indexOf('WOW64') !== -1) {
        detectedArch = 'x64';
      } else if (userAgent.indexOf('x86') !== -1 || userAgent.indexOf('i686') !== -1) {
        detectedArch = 'x86';
      } else if (userAgent.indexOf('arm64') !== -1 || userAgent.indexOf('aarch64') !== -1) {
        detectedArch = 'arm64';
      } else if (userAgent.indexOf('arm') !== -1) {
        detectedArch = 'arm';
      }

      // Get browser info with improved detection
      const browserName = (() => {
        if (userAgent.indexOf('Edge') !== -1 || userAgent.indexOf('Edg/') !== -1) {
          return 'Edge';
        }

        if (userAgent.indexOf('Chrome') !== -1) {
          return 'Chrome';
        }

        if (userAgent.indexOf('Firefox') !== -1) {
          return 'Firefox';
        }

        if (userAgent.indexOf('Safari') !== -1) {
          return 'Safari';
        }

        return 'Unknown';
      })();

      const browserVersionMatch = userAgent.match(/(Edge|Edg|Chrome|Firefox|Safari)[\s/](\d+(\.\d+)*)/);
      const browserVersion = browserVersionMatch ? browserVersionMatch[2] : 'Unknown';

      // Get performance metrics
      const memory = (performance as any).memory || {};
      const timing = performance.timing;
      const navigation = performance.navigation;
      const connection = (navigator as any).connection || {};

      // Try to use Navigation Timing API Level 2 when available
      let loadTime = 0;
      let domReadyTime = 0;

      try {
        const navEntries = performance.getEntriesByType('navigation');

        if (navEntries.length > 0) {
          const navTiming = navEntries[0] as PerformanceNavigationTiming;
          loadTime = navTiming.loadEventEnd - navTiming.startTime;
          domReadyTime = navTiming.domContentLoadedEventEnd - navTiming.startTime;
        } else {
          // Fall back to older API
          loadTime = timing.loadEventEnd - timing.navigationStart;
          domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
        }
      } catch {
        // Fall back to older API if Navigation Timing API Level 2 is not available
        loadTime = timing.loadEventEnd - timing.navigationStart;
        domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
      }

      // Get battery info
      let batteryInfo;

      try {
        const battery = await (navigator as any).getBattery();
        batteryInfo = {
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
          level: battery.level * 100,
        };
      } catch {
        console.log('Battery API not supported');
      }

      // Get storage info
      let storageInfo = {
        quota: 0,
        usage: 0,
        persistent: false,
        temporary: false,
      };

      try {
        const storage = await navigator.storage.estimate();
        const persistent = await navigator.storage.persist();
        storageInfo = {
          quota: storage.quota || 0,
          usage: storage.usage || 0,
          persistent,
          temporary: !persistent,
        };
      } catch {
        console.log('Storage API not supported');
      }

      // Get memory info from browser performance API
      const performanceMemory = (performance as any).memory || {};
      const totalMemory = performanceMemory.jsHeapSizeLimit || 0;
      const usedMemory = performanceMemory.usedJSHeapSize || 0;
      const freeMemory = totalMemory - usedMemory;
      const memoryPercentage = totalMemory ? (usedMemory / totalMemory) * 100 : 0;

      const systemInfo: SystemInfo = {
        os: detectedOS,
        arch: detectedArch,
        platform: navigator.platform || 'unknown',
        cpus: navigator.hardwareConcurrency + ' cores',
        memory: {
          total: formatBytes(totalMemory),
          free: formatBytes(freeMemory),
          used: formatBytes(usedMemory),
          percentage: Math.round(memoryPercentage),
        },
        node: 'browser',
        browser: {
          name: browserName,
          version: browserVersion,
          language: navigator.language,
          userAgent: navigator.userAgent,
          cookiesEnabled: navigator.cookieEnabled,
          online: navigator.onLine,
          platform: navigator.platform || 'unknown',
          cores: navigator.hardwareConcurrency,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          pixelRatio: window.devicePixelRatio,
        },
        time: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          offset: new Date().getTimezoneOffset(),
          locale: navigator.language,
        },
        performance: {
          memory: {
            jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
            totalJSHeapSize: memory.totalJSHeapSize || 0,
            usedJSHeapSize: memory.usedJSHeapSize || 0,
            usagePercentage: memory.totalJSHeapSize ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 : 0,
          },
          timing: {
            loadTime,
            domReadyTime,
            readyStart: timing.fetchStart - timing.navigationStart,
            redirectTime: timing.redirectEnd - timing.redirectStart,
            appcacheTime: timing.domainLookupStart - timing.fetchStart,
            unloadEventTime: timing.unloadEventEnd - timing.unloadEventStart,
            lookupDomainTime: timing.domainLookupEnd - timing.domainLookupStart,
            connectTime: timing.connectEnd - timing.connectStart,
            requestTime: timing.responseEnd - timing.requestStart,
            initDomTreeTime: timing.domInteractive - timing.responseEnd,
            loadEventTime: timing.loadEventEnd - timing.loadEventStart,
          },
          navigation: {
            type: navigation.type,
            redirectCount: navigation.redirectCount,
          },
        },
        network: {
          downlink: connection?.downlink || 0,
          effectiveType: connection?.effectiveType || 'unknown',
          rtt: connection?.rtt || 0,
          saveData: connection?.saveData || false,
          type: connection?.type || 'unknown',
        },
        battery: batteryInfo,
        storage: storageInfo,
      };

      setSystemInfo(systemInfo);
      toast.success('System information updated');
    } catch (error) {
      toast.error('Failed to get system information');
      console.error('Failed to get system information:', error);
    } finally {
      setLoading((prev) => ({ ...prev, systemInfo: false }));
    }
  };

  // Helper function to format bytes to human readable format with better precision
  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    // Return with proper precision based on unit size
    if (i === 0) {
      return `${bytes} ${units[i]}`;
    }

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };

  const getWebAppInfo = async () => {
    try {
      setLoading((prev) => ({ ...prev, webAppInfo: true }));

      const [appResponse, gitResponse] = await Promise.all([
        fetch('/api/system/app-info'),
        fetch('/api/system/git-info'),
      ]);

      if (!appResponse.ok || !gitResponse.ok) {
        throw new Error('Failed to fetch webapp info');
      }

      const appData = (await appResponse.json()) as Omit<WebAppInfo, 'gitInfo'>;
      const gitData = (await gitResponse.json()) as GitInfo;

      console.log('Git Info Response:', gitData); // Add logging to debug

      setWebAppInfo({
        ...appData,
        gitInfo: gitData,
      });

      toast.success('WebApp information updated');

      return true;
    } catch (error) {
      console.error('Failed to fetch webapp info:', error);
      toast.error('Failed to fetch webapp information');
      setWebAppInfo(null);

      return false;
    } finally {
      setLoading((prev) => ({ ...prev, webAppInfo: false }));
    }
  };

  const handleLogPerformance = () => {
    try {
      setLoading((prev) => ({ ...prev, performance: true }));

      // Get performance metrics using modern Performance API
      const performanceEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as any).memory;

      // Calculate timing metrics
      const timingMetrics = {
        loadTime: performanceEntries.loadEventEnd - performanceEntries.startTime,
        domReadyTime: performanceEntries.domContentLoadedEventEnd - performanceEntries.startTime,
        fetchTime: performanceEntries.responseEnd - performanceEntries.fetchStart,
        redirectTime: performanceEntries.redirectEnd - performanceEntries.redirectStart,
        dnsTime: performanceEntries.domainLookupEnd - performanceEntries.domainLookupStart,
        tcpTime: performanceEntries.connectEnd - performanceEntries.connectStart,
        ttfb: performanceEntries.responseStart - performanceEntries.requestStart,
        processingTime: performanceEntries.loadEventEnd - performanceEntries.responseEnd,
      };

      // Get resource timing data
      const resourceEntries = performance.getEntriesByType('resource');
      const resourceStats = {
        totalResources: resourceEntries.length,
        totalSize: resourceEntries.reduce((total, entry) => total + ((entry as any).transferSize || 0), 0),
        totalTime: Math.max(...resourceEntries.map((entry) => entry.duration)),
      };

      // Get memory metrics
      const memoryMetrics = memory
        ? {
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize,
            heapUtilization: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
          }
        : null;

      // Get frame rate metrics
      let fps = 0;

      if ('requestAnimationFrame' in window) {
        const times: number[] = [];

        function calculateFPS(now: number) {
          times.push(now);

          if (times.length > 10) {
            const fps = Math.round((1000 * 10) / (now - times[0]));
            times.shift();

            return fps;
          }

          requestAnimationFrame(calculateFPS);

          return 0;
        }

        fps = calculateFPS(performance.now());
      }

      // Log all performance metrics
      logStore.logSystem('Performance Metrics', {
        timing: timingMetrics,
        resources: resourceStats,
        memory: memoryMetrics,
        fps,
        timestamp: new Date().toISOString(),
        navigationEntry: {
          type: performanceEntries.type,
          redirectCount: performanceEntries.redirectCount,
        },
      });

      toast.success('Performance metrics logged');
    } catch (error) {
      toast.error('Failed to log performance metrics');
      console.error('Failed to log performance metrics:', error);
    } finally {
      setLoading((prev) => ({ ...prev, performance: false }));
    }
  };

  const checkErrors = async () => {
    try {
      setLoading((prev) => ({ ...prev, errors: true }));

      // Get errors from log store
      const storedErrors = errorLogs;

      if (storedErrors.length === 0) {
        toast.success('No errors found');
      } else {
        toast.warning(`Found ${storedErrors.length} error(s)`);
      }
    } catch (error) {
      toast.error('Failed to check errors');
      console.error('Failed to check errors:', error);
    } finally {
      setLoading((prev) => ({ ...prev, errors: false }));
    }
  };

  const exportDebugInfo = () => {
    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        system: systemInfo,
        webApp: webAppInfo,
        errors: logStore.getLogs().filter((log: LogEntry) => log.level === 'error'),
        performance: {
          memory: (performance as any).memory || {},
          timing: performance.timing,
          navigation: performance.navigation,
        },
      };

      const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-debug-info-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Debug information exported successfully');
    } catch (error) {
      console.error('Failed to export debug info:', error);
      toast.error('Failed to export debug information');
    }
  };

  const exportAsCSV = () => {
    try {
      const debugData = {
        system: systemInfo,
        webApp: webAppInfo,
        errors: logStore.getLogs().filter((log: LogEntry) => log.level === 'error'),
        performance: {
          memory: (performance as any).memory || {},
          timing: performance.timing,
          navigation: performance.navigation,
        },
      };

      // Convert the data to CSV format
      const csvData = [
        ['Category', 'Key', 'Value'],
        ...Object.entries(debugData).flatMap(([category, data]) =>
          Object.entries(data || {}).map(([key, value]) => [
            category,
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value),
          ]),
        ),
      ];

      // Create CSV content
      const csvContent = csvData.map((row) => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-debug-info-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Debug information exported as CSV');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export debug information as CSV');
    }
  };

  const exportAsPDF = () => {
    try {
      const debugData = {
        system: systemInfo,
        webApp: webAppInfo,
        errors: logStore.getLogs().filter((log: LogEntry) => log.level === 'error'),
        performance: {
          memory: (performance as any).memory || {},
          timing: performance.timing,
          navigation: performance.navigation,
        },
      };

      // Create new PDF document
      const doc = new jsPDF();
      const lineHeight = 7;
      let yPos = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxLineWidth = pageWidth - 2 * margin;

      // Add key-value pair with better formatting
      const addKeyValue = (key: string, value: any, indent = 0) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(10);
        doc.setTextColor('#374151');
        doc.setFont('helvetica', 'bold');

        // Format the key with proper spacing
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        doc.text(formattedKey + ':', margin + indent, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#6B7280');

        let valueText;

        if (typeof value === 'object' && value !== null) {
          // Skip rendering if value is empty object
          if (Object.keys(value).length === 0) {
            return;
          }

          yPos += lineHeight;
          Object.entries(value).forEach(([subKey, subValue]) => {
            // Check for page break before each sub-item
            if (yPos > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              yPos = margin;
            }

            const formattedSubKey = subKey.replace(/([A-Z])/g, ' $1').trim();
            addKeyValue(formattedSubKey, subValue, indent + 10);
          });

          return;
        } else {
          valueText = String(value);
        }

        const valueX = margin + indent + doc.getTextWidth(formattedKey + ': ');
        const maxValueWidth = maxLineWidth - indent - doc.getTextWidth(formattedKey + ': ');
        const lines = doc.splitTextToSize(valueText, maxValueWidth);

        // Check if we need a new page for the value
        if (yPos + lines.length * lineHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;
        }

        doc.text(lines, valueX, yPos);
        yPos += lines.length * lineHeight;
      };

      // Add section header with page break check
      const addSectionHeader = (title: string) => {
        // Check if we need a new page
        if (yPos + 20 > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;
        }

        yPos += lineHeight;
        doc.setFillColor('#F3F4F6');
        doc.rect(margin - 2, yPos - 5, pageWidth - 2 * (margin - 2), lineHeight + 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#111827');
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), margin, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += lineHeight * 1.5;
      };

      // Add horizontal line with page break check
      const addHorizontalLine = () => {
        // Check if we need a new page
        if (yPos + 10 > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;

          return; // Skip drawing line if we just started a new page
        }

        doc.setDrawColor('#E5E5E5');
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += lineHeight;
      };

      // Helper function to add footer to all pages
      const addFooters = () => {
        const totalPages = doc.internal.pages.length - 1;

        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor('#9CA3AF');
          doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
            align: 'center',
          });
        }
      };

      // Title and Header (first page only)
      doc.setFillColor('#6366F1');
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Debug Information Report', margin, 25);
      yPos = 50;

      // Timestamp and metadata
      doc.setTextColor('#6B7280');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const timestamp = new Date().toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      doc.text(`Generated: ${timestamp}`, margin, yPos);
      yPos += lineHeight * 2;

      // System Information Section
      if (debugData.system) {
        addSectionHeader('System Information');

        // OS and Architecture
        addKeyValue('Operating System', debugData.system.os);
        addKeyValue('Architecture', debugData.system.arch);
        addKeyValue('Platform', debugData.system.platform);
        addKeyValue('CPU Cores', debugData.system.cpus);

        // Memory
        const memory = debugData.system.memory;
        addKeyValue('Memory', {
          'Total Memory': memory.total,
          'Used Memory': memory.used,
          'Free Memory': memory.free,
          Usage: memory.percentage + '%',
        });

        // Browser Information
        const browser = debugData.system.browser;
        addKeyValue('Browser', {
          Name: browser.name,
          Version: browser.version,
          Language: browser.language,
          Platform: browser.platform,
          'Cookies Enabled': browser.cookiesEnabled ? 'Yes' : 'No',
          'Online Status': browser.online ? 'Online' : 'Offline',
        });

        // Screen Information
        const screen = debugData.system.screen;
        addKeyValue('Screen', {
          Resolution: `${screen.width}x${screen.height}`,
          'Color Depth': screen.colorDepth + ' bit',
          'Pixel Ratio': screen.pixelRatio + 'x',
        });

        // Time Information
        const time = debugData.system.time;
        addKeyValue('Time Settings', {
          Timezone: time.timezone,
          'UTC Offset': time.offset / 60 + ' hours',
          Locale: time.locale,
        });

        addHorizontalLine();
      }

      // Web App Information Section
      if (debugData.webApp) {
        addSectionHeader('Web App Information');

        // Basic Info
        addKeyValue('Application', {
          Name: debugData.webApp.name,
          Version: debugData.webApp.version,
          Environment: debugData.webApp.environment,
          'Node Version': debugData.webApp.runtimeInfo.nodeVersion,
        });

        // Git Information
        if (debugData.webApp.gitInfo) {
          const gitInfo = debugData.webApp.gitInfo.local;
          addKeyValue('Git Information', {
            Branch: gitInfo.branch,
            Commit: gitInfo.commitHash,
            Author: gitInfo.author,
            'Commit Time': gitInfo.commitTime,
            Repository: gitInfo.repoName,
          });

          if (debugData.webApp.gitInfo.github) {
            const githubInfo = debugData.webApp.gitInfo.github.currentRepo;
            addKeyValue('GitHub Information', {
              Repository: githubInfo.fullName,
              'Default Branch': githubInfo.defaultBranch,
              Stars: githubInfo.stars,
              Forks: githubInfo.forks,
              'Open Issues': githubInfo.openIssues || 0,
            });
          }
        }

        addHorizontalLine();
      }

      // Performance Section
      if (debugData.performance) {
        addSectionHeader('Performance Metrics');

        // Memory Usage
        const memory = debugData.performance.memory || {};
        const totalHeap = memory.totalJSHeapSize || 0;
        const usedHeap = memory.usedJSHeapSize || 0;
        const usagePercentage = memory.usagePercentage || 0;

        addKeyValue('Memory Usage', {
          'Total Heap Size': formatBytes(totalHeap),
          'Used Heap Size': formatBytes(usedHeap),
          Usage: usagePercentage.toFixed(1) + '%',
        });

        // Timing Metrics
        const timing = debugData.performance.timing || {};
        const navigationStart = timing.navigationStart || 0;
        const loadEventEnd = timing.loadEventEnd || 0;
        const domContentLoadedEventEnd = timing.domContentLoadedEventEnd || 0;
        const responseEnd = timing.responseEnd || 0;
        const requestStart = timing.requestStart || 0;

        const loadTime = loadEventEnd > navigationStart ? loadEventEnd - navigationStart : 0;
        const domReadyTime =
          domContentLoadedEventEnd > navigationStart ? domContentLoadedEventEnd - navigationStart : 0;
        const requestTime = responseEnd > requestStart ? responseEnd - requestStart : 0;

        addKeyValue('Page Load Metrics', {
          'Total Load Time': (loadTime / 1000).toFixed(2) + ' seconds',
          'DOM Ready Time': (domReadyTime / 1000).toFixed(2) + ' seconds',
          'Request Time': (requestTime / 1000).toFixed(2) + ' seconds',
        });

        // Network Information
        if (debugData.system?.network) {
          const network = debugData.system.network;
          addKeyValue('Network Information', {
            'Connection Type': network.type || 'Unknown',
            'Effective Type': network.effectiveType || 'Unknown',
            'Download Speed': (network.downlink || 0) + ' Mbps',
            'Latency (RTT)': (network.rtt || 0) + ' ms',
            'Data Saver': network.saveData ? 'Enabled' : 'Disabled',
          });
        }

        addHorizontalLine();
      }

      // Errors Section
      if (debugData.errors && debugData.errors.length > 0) {
        addSectionHeader('Error Log');

        debugData.errors.forEach((error: LogEntry, index: number) => {
          doc.setTextColor('#DC2626');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`Error ${index + 1}:`, margin, yPos);
          yPos += lineHeight;

          doc.setFont('helvetica', 'normal');
          doc.setTextColor('#6B7280');
          addKeyValue('Message', error.message, 10);

          if (error.stack) {
            addKeyValue('Stack', error.stack, 10);
          }

          if (error.source) {
            addKeyValue('Source', error.source, 10);
          }

          yPos += lineHeight;
        });
      }

      // Add footers to all pages at the end
      addFooters();

      // Save the PDF
      doc.save(`bolt-debug-info-${new Date().toISOString()}.pdf`);
      toast.success('Debug information exported as PDF');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('Failed to export debug information as PDF');
    }
  };

  const exportAsText = () => {
    try {
      const debugData = {
        system: systemInfo,
        webApp: webAppInfo,
        errors: logStore.getLogs().filter((log: LogEntry) => log.level === 'error'),
        performance: {
          memory: (performance as any).memory || {},
          timing: performance.timing,
          navigation: performance.navigation,
        },
      };

      const textContent = Object.entries(debugData)
        .map(([category, data]) => {
          return `${category.toUpperCase()}\n${'-'.repeat(30)}\n${JSON.stringify(data, null, 2)}\n\n`;
        })
        .join('\n');

      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-debug-info-${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Debug information exported as text file');
    } catch (error) {
      console.error('Failed to export text file:', error);
      toast.error('Failed to export debug information as text file');
    }
  };

  const exportFormats: ExportFormat[] = [
    {
      id: 'json',
      label: 'Export as JSON',
      icon: 'i-ph:file-js',
      handler: exportDebugInfo,
    },
    {
      id: 'csv',
      label: 'Export as CSV',
      icon: 'i-ph:file-csv',
      handler: exportAsCSV,
    },
    {
      id: 'pdf',
      label: 'Export as PDF',
      icon: 'i-ph:file-pdf',
      handler: exportAsPDF,
    },
    {
      id: 'txt',
      label: 'Export as Text',
      icon: 'i-ph:file-text',
      handler: exportAsText,
    },
  ];

  // Add Ollama health check function
  const checkOllamaStatus = useCallback(async () => {
    try {
      const ollamaProvider = providers?.Ollama;
      const baseUrl = ollamaProvider?.settings?.baseUrl || 'http://127.0.0.1:11434';

      // First check if service is running
      const versionResponse = await fetch(`${baseUrl}/api/version`);

      if (!versionResponse.ok) {
        throw new Error('Service not running');
      }

      // Then fetch installed models
      const modelsResponse = await fetch(`${baseUrl}/api/tags`);

      const modelsData = (await modelsResponse.json()) as {
        models: Array<{ name: string; size: string; quantization: string }>;
      };

      setOllamaStatus({
        isRunning: true,
        lastChecked: new Date(),
        models: modelsData.models,
      });
    } catch {
      setOllamaStatus({
        isRunning: false,
        error: 'Connection failed',
        lastChecked: new Date(),
        models: undefined,
      });
    }
  }, [providers]);

  // Monitor Ollama provider status and check periodically
  useEffect(() => {
    const ollamaProvider = providers?.Ollama;

    if (ollamaProvider?.settings?.enabled) {
      // Check immediately when provider is enabled
      checkOllamaStatus();

      // Set up periodic checks every 10 seconds
      const intervalId = setInterval(checkOllamaStatus, 10000);

      return () => clearInterval(intervalId);
    }

    return undefined;
  }, [providers, checkOllamaStatus]);

  // Replace the existing export button with this new component
  const ExportButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
    }, []);

    const handleFormatClick = useCallback((handler: () => void) => {
      handler();
      setIsOpen(false);
    }, []);

    return (
      <DialogRoot open={isOpen} onOpenChange={handleOpenChange}>
        <button
          onClick={() => setIsOpen(true)}
          className={classNames(
            'group flex items-center gap-2',
            'rounded-lg px-3 py-1.5',
            'text-sm text-gray-900 dark:text-white',
            'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
            'transition-all duration-200',
          )}
        >
          <span className="i-ph:download text-lg text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
          Export
        </button>

        <Dialog showCloseButton>
          <div className="p-6">
            <DialogTitle className="flex items-center gap-2">
              <div className="i-ph:download w-5 h-5" />
              Export Debug Information
            </DialogTitle>

            <div className="mt-4 flex flex-col gap-2">
              {exportFormats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleFormatClick(format.handler)}
                  className={classNames(
                    'flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors w-full text-left',
                    'bg-white dark:bg-[#0A0A0A]',
                    'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                    'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
                    'hover:border-purple-200 dark:hover:border-purple-900/30',
                    'text-bolt-elements-textPrimary',
                  )}
                >
                  <div className={classNames(format.icon, 'w-5 h-5')} />
                  <div>
                    <div className="font-medium">{format.label}</div>
                    <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                      {format.id === 'json' && 'Export as a structured JSON file'}
                      {format.id === 'csv' && 'Export as a CSV spreadsheet'}
                      {format.id === 'pdf' && 'Export as a formatted PDF document'}
                      {format.id === 'txt' && 'Export as a formatted text file'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    );
  };

  // Add helper function to get Ollama status text and color
  const getOllamaStatus = () => {
    const ollamaProvider = providers?.Ollama;
    const isOllamaEnabled = ollamaProvider?.settings?.enabled;

    if (!isOllamaEnabled) {
      return {
        status: 'Disabled',
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        message: 'Ollama provider is disabled in settings',
      };
    }

    if (!ollamaStatus.isRunning) {
      return {
        status: 'Not Running',
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        message: ollamaStatus.error || 'Ollama service is not running',
      };
    }

    const modelCount = ollamaStatus.models?.length ?? 0;

    return {
      status: 'Running',
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      message: `Ollama service is running with ${modelCount} installed models (Provider: Enabled)`,
    };
  };

  // Add type for status result
  type StatusResult = {
    status: string;
    color: string;
    bgColor: string;
    message: string;
  };

  const status = getOllamaStatus() as StatusResult;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4">
      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Errors Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-200 h-[180px] flex flex-col">
          <div className="flex items-center gap-2">
            <div className="i-ph:warning-octagon text-purple-500 w-4 h-4" />
            <div className="text-sm text-bolt-elements-textSecondary">Errors</div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={classNames('text-2xl font-semibold', errorLogs.length > 0 ? 'text-red-500' : 'text-green-500')}
            >
              {errorLogs.length}
            </span>
          </div>
          <div className="text-xs text-bolt-elements-textSecondary mt-2 flex items-center gap-1.5">
            <div
              className={classNames(
                'w-3.5 h-3.5',
                errorLogs.length > 0 ? 'i-ph:warning text-red-500' : 'i-ph:check-circle text-green-500',
              )}
            />
            {errorLogs.length > 0 ? 'Errors detected' : 'No errors detected'}
          </div>
        </div>

        {/* Memory Usage Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-200 h-[180px] flex flex-col">
          <div className="flex items-center gap-2">
            <div className="i-ph:cpu text-purple-500 w-4 h-4" />
            <div className="text-sm text-bolt-elements-textSecondary">Memory Usage</div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={classNames(
                'text-2xl font-semibold',
                (systemInfo?.memory?.percentage ?? 0) > 80
                  ? 'text-red-500'
                  : (systemInfo?.memory?.percentage ?? 0) > 60
                    ? 'text-yellow-500'
                    : 'text-green-500',
              )}
            >
              {systemInfo?.memory?.percentage ?? 0}%
            </span>
          </div>
          <Progress
            value={systemInfo?.memory?.percentage ?? 0}
            className={classNames(
              'mt-2',
              (systemInfo?.memory?.percentage ?? 0) > 80
                ? '[&>div]:bg-red-500'
                : (systemInfo?.memory?.percentage ?? 0) > 60
                  ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-green-500',
            )}
          />
          <div className="text-xs text-bolt-elements-textSecondary mt-2 flex items-center gap-1.5">
            <div className="i-ph:info w-3.5 h-3.5 text-purple-500" />
            Used: {systemInfo?.memory.used ?? '0 GB'} / {systemInfo?.memory.total ?? '0 GB'}
          </div>
        </div>

        {/* Page Load Time Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-200 h-[180px] flex flex-col">
          <div className="flex items-center gap-2">
            <div className="i-ph:timer text-purple-500 w-4 h-4" />
            <div className="text-sm text-bolt-elements-textSecondary">Page Load Time</div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={classNames(
                'text-2xl font-semibold',
                (systemInfo?.performance.timing.loadTime ?? 0) > 2000
                  ? 'text-red-500'
                  : (systemInfo?.performance.timing.loadTime ?? 0) > 1000
                    ? 'text-yellow-500'
                    : 'text-green-500',
              )}
            >
              {systemInfo ? (systemInfo.performance.timing.loadTime / 1000).toFixed(2) : '-'}s
            </span>
          </div>
          <div className="text-xs text-bolt-elements-textSecondary mt-2 flex items-center gap-1.5">
            <div className="i-ph:code w-3.5 h-3.5 text-purple-500" />
            DOM Ready: {systemInfo ? (systemInfo.performance.timing.domReadyTime / 1000).toFixed(2) : '-'}s
          </div>
        </div>

        {/* Network Speed Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-200 h-[180px] flex flex-col">
          <div className="flex items-center gap-2">
            <div className="i-ph:wifi-high text-purple-500 w-4 h-4" />
            <div className="text-sm text-bolt-elements-textSecondary">Network Speed</div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={classNames(
                'text-2xl font-semibold',
                (systemInfo?.network.downlink ?? 0) < 5
                  ? 'text-red-500'
                  : (systemInfo?.network.downlink ?? 0) < 10
                    ? 'text-yellow-500'
                    : 'text-green-500',
              )}
            >
              {systemInfo?.network.downlink ?? '-'} Mbps
            </span>
          </div>
          <div className="text-xs text-bolt-elements-textSecondary mt-2 flex items-center gap-1.5">
            <div className="i-ph:activity w-3.5 h-3.5 text-purple-500" />
            RTT: {systemInfo?.network.rtt ?? '-'} ms
          </div>
        </div>

        {/* Ollama Service Card - Now spans all 4 columns */}
        <div className="md:col-span-4 p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-200 h-[260px] flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="i-ph:robot text-purple-500 w-5 h-5" />
              <div>
                <div className="text-base font-medium text-bolt-elements-textPrimary">Ollama Service</div>
                <div className="text-xs text-bolt-elements-textSecondary mt-0.5">{status.message}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-bolt-elements-background-depth-3">
                <div
                  className={classNames('w-2 h-2 rounded-full animate-pulse', status.bgColor, {
                    'shadow-lg shadow-green-500/20': status.status === 'Running',
                    'shadow-lg shadow-red-500/20': status.status === 'Not Running',
                  })}
                />
                <span className={classNames('text-xs font-medium flex items-center gap-1', status.color)}>
                  {status.status}
                </span>
              </div>
              <div className="text-[10px] text-bolt-elements-textTertiary flex items-center gap-1.5">
                <div className="i-ph:clock w-3 h-3" />
                {ollamaStatus.lastChecked.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="mt-6 flex-1 min-h-0 flex flex-col">
            {status.status === 'Running' && ollamaStatus.models && ollamaStatus.models.length > 0 ? (
              <>
                <div className="text-xs font-medium text-bolt-elements-textSecondary flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:cube-duotone w-4 h-4 text-purple-500" />
                    <span>Installed Models</span>
                    <Badge variant="secondary" className="ml-1">
                      {ollamaStatus.models.length}
                    </Badge>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-600">
                  <div className="grid grid-cols-2 gap-3 pr-2">
                    {ollamaStatus.models.map((model) => (
                      <div
                        key={model.name}
                        className="text-sm bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 rounded-lg px-4 py-3 flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
                          <div className="i-ph:cube w-4 h-4 text-purple-500/70 group-hover:text-purple-500 transition-colors" />
                          <span className="font-mono truncate">{model.name}</span>
                        </div>
                        <Badge variant="outline" className="ml-2 text-xs font-mono">
                          {Math.round(parseInt(model.size) / 1024 / 1024)}MB
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 max-w-[280px] text-center">
                  <div
                    className={classNames('w-12 h-12', {
                      'i-ph:warning-circle text-red-500/80':
                        status.status === 'Not Running' || status.status === 'Disabled',
                      'i-ph:cube-duotone text-purple-500/80': status.status === 'Running',
                    })}
                  />
                  <span className="text-sm text-bolt-elements-textSecondary">{status.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={getSystemInfo}
          disabled={loading.systemInfo}
          className={classNames(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-white dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
            'hover:border-purple-200 dark:hover:border-purple-900/30',
            'text-bolt-elements-textPrimary',
            { 'opacity-50 cursor-not-allowed': loading.systemInfo },
          )}
        >
          {loading.systemInfo ? (
            <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
          ) : (
            <div className="i-ph:gear w-4 h-4" />
          )}
          Update System Info
        </button>

        <button
          onClick={handleLogPerformance}
          disabled={loading.performance}
          className={classNames(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-white dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
            'hover:border-purple-200 dark:hover:border-purple-900/30',
            'text-bolt-elements-textPrimary',
            { 'opacity-50 cursor-not-allowed': loading.performance },
          )}
        >
          {loading.performance ? (
            <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
          ) : (
            <div className="i-ph:chart-bar w-4 h-4" />
          )}
          Log Performance
        </button>

        <button
          onClick={checkErrors}
          disabled={loading.errors}
          className={classNames(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-white dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
            'hover:border-purple-200 dark:hover:border-purple-900/30',
            'text-bolt-elements-textPrimary',
            { 'opacity-50 cursor-not-allowed': loading.errors },
          )}
        >
          {loading.errors ? (
            <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
          ) : (
            <div className="i-ph:warning w-4 h-4" />
          )}
          Check Errors
        </button>

        <button
          onClick={getWebAppInfo}
          disabled={loading.webAppInfo}
          className={classNames(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            'bg-white dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
            'hover:border-purple-200 dark:hover:border-purple-900/30',
            'text-bolt-elements-textPrimary',
            { 'opacity-50 cursor-not-allowed': loading.webAppInfo },
          )}
        >
          {loading.webAppInfo ? (
            <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
          ) : (
            <div className="i-ph:info w-4 h-4" />
          )}
          Fetch WebApp Info
        </button>

        <ExportButton />
      </div>

      {/* System Information */}
      <Collapsible
        open={openSections.system}
        onOpenChange={(open: boolean) => setOpenSections((prev) => ({ ...prev, system: open }))}
        className="w-full"
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="i-ph:cpu text-purple-500 w-5 h-5" />
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">System Information</h3>
            </div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 transform transition-transform duration-200',
                openSections.system ? 'rotate-180' : '',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 mt-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            {systemInfo ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:desktop text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">OS: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.os}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:device-mobile text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Platform: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.platform}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:circuitry text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Architecture: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.arch}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:cpu text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">CPU Cores: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.cpus}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:graph text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Node Version: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.node}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:wifi-high text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Network Type: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.network.type} ({systemInfo.network.effectiveType})
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:gauge text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Network Speed: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.network.downlink}Mbps (RTT: {systemInfo.network.rtt}ms)
                    </span>
                  </div>
                  {systemInfo.battery && (
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:battery-charging text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Battery: </span>
                      <span className="text-bolt-elements-textPrimary">
                        {systemInfo.battery.level.toFixed(1)}% {systemInfo.battery.charging ? '(Charging)' : ''}
                      </span>
                    </div>
                  )}
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:hard-drive text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Storage: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.storage.usage / (1024 * 1024 * 1024)).toFixed(2)}GB /{' '}
                      {(systemInfo.storage.quota / (1024 * 1024 * 1024)).toFixed(2)}GB
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:database text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Memory Usage: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.memory.used} / {systemInfo.memory.total} ({systemInfo.memory.percentage}%)
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:browser text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Browser: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.browser.name} {systemInfo.browser.version}
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:monitor text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Screen: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.screen.width}x{systemInfo.screen.height} ({systemInfo.screen.pixelRatio}x)
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:clock text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Timezone: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.time.timezone}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:translate text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Language: </span>
                    <span className="text-bolt-elements-textPrimary">{systemInfo.browser.language}</span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:chart-pie text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">JS Heap: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB /{' '}
                      {(systemInfo.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)}MB (
                      {systemInfo.performance.memory.usagePercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:timer text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">Page Load: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.loadTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <div className="i-ph:code text-bolt-elements-textSecondary w-4 h-4" />
                    <span className="text-bolt-elements-textSecondary">DOM Ready: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.domReadyTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-bolt-elements-textSecondary">Loading system information...</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Performance Metrics */}
      <Collapsible
        open={openSections.performance}
        onOpenChange={(open: boolean) => setOpenSections((prev) => ({ ...prev, performance: open }))}
        className="w-full"
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="i-ph:chart-line text-purple-500 w-5 h-5" />
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Performance Metrics</h3>
            </div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 transform transition-transform duration-200',
                openSections.performance ? 'rotate-180' : '',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 mt-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            {systemInfo && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Page Load Time: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.loadTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">DOM Ready Time: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.domReadyTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Request Time: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.requestTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Redirect Time: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.timing.redirectTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">JS Heap Usage: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {(systemInfo.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB /{' '}
                      {(systemInfo.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Heap Utilization: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.performance.memory.usagePercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Navigation Type: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.performance.navigation.type === 0
                        ? 'Navigate'
                        : systemInfo.performance.navigation.type === 1
                          ? 'Reload'
                          : systemInfo.performance.navigation.type === 2
                            ? 'Back/Forward'
                            : 'Other'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-bolt-elements-textSecondary">Redirects: </span>
                    <span className="text-bolt-elements-textPrimary">
                      {systemInfo.performance.navigation.redirectCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* WebApp Information */}
      <Collapsible
        open={openSections.webapp}
        onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, webapp: open }))}
        className="w-full"
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="i-ph:info text-blue-500 w-5 h-5" />
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">WebApp Information</h3>
              {loading.webAppInfo && <span className="loading loading-spinner loading-sm" />}
            </div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 transform transition-transform duration-200',
                openSections.webapp ? 'rotate-180' : '',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 mt-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            {loading.webAppInfo ? (
              <div className="flex items-center justify-center p-8">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : !webAppInfo ? (
              <div className="flex flex-col items-center justify-center p-8 text-bolt-elements-textSecondary">
                <div className="i-ph:warning-circle w-8 h-8 mb-2" />
                <p>Failed to load WebApp information</p>
                <button
                  onClick={() => getWebAppInfo()}
                  className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="mb-4 text-base font-medium text-bolt-elements-textPrimary">Basic Information</h3>
                  <div className="space-y-3">
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:app-window text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Name:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.name}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:tag text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Version:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.version}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:certificate text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">License:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.license}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:cloud text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Environment:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.environment}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:graph text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Node Version:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.runtimeInfo.nodeVersion}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-base font-medium text-bolt-elements-textPrimary">Git Information</h3>
                  <div className="space-y-3">
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:git-branch text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Branch:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.gitInfo.local.branch}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:git-commit text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Commit:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.gitInfo.local.commitHash}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:user text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Author:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.gitInfo.local.author}</span>
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <div className="i-ph:clock text-bolt-elements-textSecondary w-4 h-4" />
                      <span className="text-bolt-elements-textSecondary">Commit Time:</span>
                      <span className="text-bolt-elements-textPrimary">{webAppInfo.gitInfo.local.commitTime}</span>
                    </div>

                    {webAppInfo.gitInfo.github && (
                      <>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                          <div className="text-sm flex items-center gap-2">
                            <div className="i-ph:git-fork text-bolt-elements-textSecondary w-4 h-4" />
                            <span className="text-bolt-elements-textSecondary">Repository:</span>
                            <span className="text-bolt-elements-textPrimary">
                              {webAppInfo.gitInfo.github.currentRepo.fullName}
                              {webAppInfo.gitInfo.isForked && ' (fork)'}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <div className="i-ph:star text-yellow-500 w-4 h-4" />
                              <span className="text-bolt-elements-textSecondary">
                                {webAppInfo.gitInfo.github.currentRepo.stars}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="i-ph:git-fork text-blue-500 w-4 h-4" />
                              <span className="text-bolt-elements-textSecondary">
                                {webAppInfo.gitInfo.github.currentRepo.forks}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="i-ph:warning-circle text-red-500 w-4 h-4" />
                              <span className="text-bolt-elements-textSecondary">
                                {webAppInfo.gitInfo.github.currentRepo.openIssues}
                              </span>
                            </div>
                          </div>
                        </div>

                        {webAppInfo.gitInfo.github.upstream && (
                          <div className="mt-2">
                            <div className="text-sm flex items-center gap-2">
                              <div className="i-ph:git-fork text-bolt-elements-textSecondary w-4 h-4" />
                              <span className="text-bolt-elements-textSecondary">Upstream:</span>
                              <span className="text-bolt-elements-textPrimary">
                                {webAppInfo.gitInfo.github.upstream.fullName}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <div className="i-ph:star text-yellow-500 w-4 h-4" />
                                <span className="text-bolt-elements-textSecondary">
                                  {webAppInfo.gitInfo.github.upstream.stars}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="i-ph:git-fork text-blue-500 w-4 h-4" />
                                <span className="text-bolt-elements-textSecondary">
                                  {webAppInfo.gitInfo.github.upstream.forks}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {webAppInfo && (
              <div className="mt-6">
                <h3 className="mb-4 text-base font-medium text-bolt-elements-textPrimary">Dependencies</h3>
                <div className="bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded-lg divide-y divide-[#E5E5E5] dark:divide-[#1A1A1A]">
                  <DependencySection title="Production" deps={webAppInfo.dependencies.production} />
                  <DependencySection title="Development" deps={webAppInfo.dependencies.development} />
                  <DependencySection title="Peer" deps={webAppInfo.dependencies.peer} />
                  <DependencySection title="Optional" deps={webAppInfo.dependencies.optional} />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Error Check */}
      <Collapsible
        open={openSections.errors}
        onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, errors: open }))}
        className="w-full"
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="i-ph:warning text-red-500 w-5 h-5" />
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Error Check</h3>
              {errorLogs.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {errorLogs.length} Errors
                </Badge>
              )}
            </div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 transform transition-transform duration-200',
                openSections.errors ? 'rotate-180' : '',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 mt-2 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                <div className="text-sm text-bolt-elements-textSecondary">
                  Checks for:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Unhandled JavaScript errors</li>
                    <li>Unhandled Promise rejections</li>
                    <li>Runtime exceptions</li>
                    <li>Network errors</li>
                  </ul>
                </div>
                <div className="text-sm">
                  <span className="text-bolt-elements-textSecondary">Status: </span>
                  <span className="text-bolt-elements-textPrimary">
                    {loading.errors
                      ? 'Checking...'
                      : errorLogs.length > 0
                        ? `${errorLogs.length} errors found`
                        : 'No errors found'}
                  </span>
                </div>
                {errorLogs.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Recent Errors:</div>
                    <div className="space-y-2">
                      {errorLogs.map((error) => (
                        <div key={error.id} className="text-sm text-red-500 dark:text-red-400 p-2 rounded bg-red-500/5">
                          <div className="font-medium">{error.message}</div>
                          {error.source && (
                            <div className="text-xs mt-1 text-red-400">
                              Source: {error.source}
                              {error.details?.lineNumber && `:${error.details.lineNumber}`}
                            </div>
                          )}
                          {error.stack && (
                            <div className="text-xs mt-1 text-red-400 font-mono whitespace-pre-wrap">{error.stack}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

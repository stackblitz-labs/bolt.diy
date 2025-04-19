import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { logStore, type LogEntry } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { jsPDF } from 'jspdf';
import { toast } from 'react-toastify';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

const logLevelOptions: SelectOption[] = [
  {
    value: 'all',
    label: 'All Types',
    icon: 'i-ph:funnel',
    color: '#9333ea',
  },
  {
    value: 'provider',
    label: 'LLM',
    icon: 'i-ph:robot',
    color: '#10b981',
  },
  {
    value: 'api',
    label: 'API',
    icon: 'i-ph:cloud',
    color: '#3b82f6',
  },
  {
    value: 'error',
    label: 'Errors',
    icon: 'i-ph:warning-circle',
    color: '#ef4444',
  },
  {
    value: 'warning',
    label: 'Warnings',
    icon: 'i-ph:warning',
    color: '#f59e0b',
  },
  {
    value: 'info',
    label: 'Info',
    icon: 'i-ph:info',
    color: '#3b82f6',
  },
  {
    value: 'debug',
    label: 'Debug',
    icon: 'i-ph:bug',
    color: '#6b7280',
  },
];

interface LogEntryItemProps {
  log: LogEntry;
  isExpanded: boolean;
  use24Hour: boolean;
  showTimestamp: boolean;
}

const LogEntryItem = ({ log, isExpanded: forceExpanded, use24Hour, showTimestamp }: LogEntryItemProps) => {
  const [localExpanded, setLocalExpanded] = useState(forceExpanded);

  useEffect(() => {
    setLocalExpanded(forceExpanded);
  }, [forceExpanded]);

  const timestamp = useMemo(() => {
    const date = new Date(log.timestamp);
    return date.toLocaleTimeString('en-US', { hour12: !use24Hour });
  }, [log.timestamp, use24Hour]);

  const style = useMemo(() => {
    if (log.category === 'provider') {
      return {
        icon: 'i-ph:robot',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20',
        badge: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
      };
    }

    if (log.category === 'api') {
      return {
        icon: 'i-ph:cloud',
        color: 'text-blue-500 dark:text-blue-400',
        bg: 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20',
        badge: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
      };
    }

    switch (log.level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          color: 'text-red-500 dark:text-red-400',
          bg: 'hover:bg-red-500/10 dark:hover:bg-red-500/20',
          badge: 'text-red-500 bg-red-50 dark:bg-red-500/10',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          color: 'text-yellow-500 dark:text-yellow-400',
          bg: 'hover:bg-yellow-500/10 dark:hover:bg-yellow-500/20',
          badge: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10',
        };
      case 'debug':
        return {
          icon: 'i-ph:bug',
          color: 'text-gray-500 dark:text-gray-400',
          bg: 'hover:bg-gray-500/10 dark:hover:bg-gray-500/20',
          badge: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10',
        };
      default:
        return {
          icon: 'i-ph:info',
          color: 'text-blue-500 dark:text-blue-400',
          bg: 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20',
          badge: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
        };
    }
  }, [log.level, log.category]);

  const renderDetails = (details: any) => {
    if (log.category === 'provider') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Model: {details.model}</span>
            <span>•</span>
            <span>Tokens: {details.totalTokens}</span>
            <span>•</span>
            <span>Duration: {details.duration}ms</span>
          </div>
          {details.prompt && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Prompt:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {details.prompt}
              </pre>
            </div>
          )}
          {details.response && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Response:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {details.response}
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (log.category === 'api') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={details.method === 'GET' ? 'text-green-500' : 'text-blue-500'}>{details.method}</span>
            <span>•</span>
            <span>Status: {details.statusCode}</span>
            <span>•</span>
            <span>Duration: {details.duration}ms</span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 break-all">{details.url}</div>
          {details.request && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Request:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.request, null, 2)}
              </pre>
            </div>
          )}
          {details.response && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Response:</div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.response, null, 2)}
              </pre>
            </div>
          )}
          {details.error && (
            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-red-500">Error:</div>
              <pre className="text-xs text-red-400 bg-red-50 dark:bg-red-500/10 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(details.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded whitespace-pre-wrap">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        'flex flex-col gap-2',
        'rounded-lg p-4',
        'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
        'border border-[#E5E5E5] dark:border-[#1A1A1A]',
        style.bg,
        'transition-all duration-200',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={classNames('text-lg', style.icon, style.color)} />
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{log.message}</div>
            {log.details && (
              <>
                <button
                  onClick={() => setLocalExpanded(!localExpanded)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                >
                  {localExpanded ? 'Hide' : 'Show'} Details
                </button>
                {localExpanded && renderDetails(log.details)}
              </>
            )}
            <div className="flex items-center gap-2">
              <div className={classNames('px-2 py-0.5 rounded text-xs font-medium uppercase', style.badge)}>
                {log.level}
              </div>
              {log.category && (
                <div className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  {log.category}
                </div>
              )}
            </div>
          </div>
        </div>
        {showTimestamp && <time className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{timestamp}</time>}
      </div>
    </motion.div>
  );
};

interface ExportFormat {
  id: string;
  label: string;
  icon: string;
  handler: () => void;
}

export function EventLogsTab() {
  const logs = useStore(logStore.logs);
  const [selectedLevel, setSelectedLevel] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [use24Hour, setUse24Hour] = useState(false);
  const [autoExpand, setAutoExpand] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const levelFilterRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    const allLogs = Object.values(logs);

    if (selectedLevel === 'all') {
      return allLogs.filter((log) =>
        searchQuery ? log.message.toLowerCase().includes(searchQuery.toLowerCase()) : true,
      );
    }

    return allLogs.filter((log) => {
      const matchesType = log.category === selectedLevel || log.level === selectedLevel;
      const matchesSearch = searchQuery ? log.message.toLowerCase().includes(searchQuery.toLowerCase()) : true;

      return matchesType && matchesSearch;
    });
  }, [logs, selectedLevel, searchQuery]);

  // Add performance tracking on mount
  useEffect(() => {
    const startTime = performance.now();

    logStore.logInfo('Event Logs tab mounted', {
      type: 'component_mount',
      message: 'Event Logs tab component mounted',
      component: 'EventLogsTab',
    });

    return () => {
      const duration = performance.now() - startTime;
      logStore.logPerformanceMetric('EventLogsTab', 'mount-duration', duration);
    };
  }, []);

  // Log filter changes
  const handleLevelFilterChange = useCallback(
    (newLevel: string) => {
      logStore.logInfo('Log level filter changed', {
        type: 'filter_change',
        message: `Log level filter changed from ${selectedLevel} to ${newLevel}`,
        component: 'EventLogsTab',
        previousLevel: selectedLevel,
        newLevel,
      });
      setSelectedLevel(newLevel as string);
      setShowLevelFilter(false);
    },
    [selectedLevel],
  );

  // Log search changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        logStore.logInfo('Log search performed', {
          type: 'search',
          message: `Search performed with query "${searchQuery}" (${filteredLogs.length} results)`,
          component: 'EventLogsTab',
          query: searchQuery,
          resultsCount: filteredLogs.length,
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filteredLogs.length]);

  // Enhanced refresh handler
  const handleRefresh = useCallback(async () => {
    const startTime = performance.now();
    setIsRefreshing(true);

    try {
      await logStore.refreshLogs();

      const duration = performance.now() - startTime;

      logStore.logSuccess('Logs refreshed successfully', {
        type: 'refresh',
        message: `Successfully refreshed ${Object.keys(logs).length} logs`,
        component: 'EventLogsTab',
        duration,
        logsCount: Object.keys(logs).length,
      });
    } catch (error) {
      logStore.logError('Failed to refresh logs', error, {
        type: 'refresh_error',
        message: 'Failed to refresh logs',
        component: 'EventLogsTab',
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [logs]);

  // Log preference changes
  const handlePreferenceChange = useCallback((type: string, value: boolean) => {
    logStore.logInfo('Log preference changed', {
      type: 'preference_change',
      message: `Log preference "${type}" changed to ${value}`,
      component: 'EventLogsTab',
      preference: type,
      value,
    });

    switch (type) {
      case 'timestamps':
        setShowTimestamps(value);
        break;
      case '24hour':
        setUse24Hour(value);
        break;
      case 'autoExpand':
        setAutoExpand(value);
        break;
    }
  }, []);

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (levelFilterRef.current && !levelFilterRef.current.contains(event.target as Node)) {
        setShowLevelFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLevelOption = logLevelOptions.find((opt) => opt.value === selectedLevel);

  // Export functions
  const exportAsJSON = () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        logs: filteredLogs,
        filters: {
          level: selectedLevel,
          searchQuery,
        },
        preferences: {
          use24Hour,
          showTimestamps,
          autoExpand,
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-event-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Event logs exported successfully as JSON');
    } catch (error) {
      console.error('Failed to export JSON:', error);
      toast.error('Failed to export event logs as JSON');
    }
  };

  const exportAsCSV = () => {
    try {
      // Convert logs to CSV format
      const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Details'];
      const csvData = [
        headers,
        ...filteredLogs.map((log) => [
          new Date(log.timestamp).toISOString(),
          log.level,
          log.category || '',
          log.message,
          log.details ? JSON.stringify(log.details) : '',
        ]),
      ];

      const csvContent = csvData
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-event-logs-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Event logs exported successfully as CSV');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export event logs as CSV');
    }
  };

  const exportAsPDF = () => {
    try {
      // Create new PDF document
      const doc = new jsPDF();
      const lineHeight = 7;
      let yPos = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxLineWidth = pageWidth - 2 * margin;

      // Helper function to add section header
      const addSectionHeader = (title: string) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFillColor('#F3F4F6');
        doc.rect(margin - 2, yPos - 5, pageWidth - 2 * (margin - 2), lineHeight + 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#111827');
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), margin, yPos);
        yPos += lineHeight * 2;
      };

      // Add title and header
      doc.setFillColor('#6366F1');
      doc.rect(0, 0, pageWidth, 50, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Event Logs Report', margin, 35);

      // Add subtitle with bolt.diy
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('bolt.diy - AI Development Platform', margin, 45);
      yPos = 70;

      // Add report summary section
      addSectionHeader('Report Summary');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#374151');

      const summaryItems = [
        { label: 'Generated', value: new Date().toLocaleString() },
        { label: 'Total Logs', value: filteredLogs.length.toString() },
        { label: 'Filter Applied', value: selectedLevel === 'all' ? 'All Types' : selectedLevel },
        { label: 'Search Query', value: searchQuery || 'None' },
        { label: 'Time Format', value: use24Hour ? '24-hour' : '12-hour' },
      ];

      summaryItems.forEach((item) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.label}:`, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(item.value, margin + 60, yPos);
        yPos += lineHeight;
      });

      yPos += lineHeight * 2;

      // Add statistics section
      addSectionHeader('Log Statistics');

      // Calculate statistics
      const stats = {
        error: filteredLogs.filter((log) => log.level === 'error').length,
        warning: filteredLogs.filter((log) => log.level === 'warning').length,
        info: filteredLogs.filter((log) => log.level === 'info').length,
        debug: filteredLogs.filter((log) => log.level === 'debug').length,
        provider: filteredLogs.filter((log) => log.category === 'provider').length,
        api: filteredLogs.filter((log) => log.category === 'api').length,
      };

      // Create two columns for statistics
      const leftStats = [
        { label: 'Error Logs', value: stats.error, color: '#DC2626' },
        { label: 'Warning Logs', value: stats.warning, color: '#F59E0B' },
        { label: 'Info Logs', value: stats.info, color: '#3B82F6' },
      ];

      const rightStats = [
        { label: 'Debug Logs', value: stats.debug, color: '#6B7280' },
        { label: 'LLM Logs', value: stats.provider, color: '#10B981' },
        { label: 'API Logs', value: stats.api, color: '#3B82F6' },
      ];

      const colWidth = (pageWidth - 2 * margin) / 2;

      // Draw statistics in two columns
      leftStats.forEach((stat, index) => {
        doc.setTextColor(stat.color);
        doc.setFont('helvetica', 'bold');
        doc.text(stat.value.toString(), margin, yPos);
        doc.setTextColor('#374151');
        doc.setFont('helvetica', 'normal');
        doc.text(stat.label, margin + 20, yPos);

        if (rightStats[index]) {
          doc.setTextColor(rightStats[index].color);
          doc.setFont('helvetica', 'bold');
          doc.text(rightStats[index].value.toString(), margin + colWidth, yPos);
          doc.setTextColor('#374151');
          doc.setFont('helvetica', 'normal');
          doc.text(rightStats[index].label, margin + colWidth + 20, yPos);
        }

        yPos += lineHeight;
      });

      yPos += lineHeight * 2;

      // Add logs section
      addSectionHeader('Event Logs');

      // Helper function to add a log entry with improved formatting
      const addLogEntry = (log: LogEntry) => {
        const entryHeight = 20 + (log.details ? 40 : 0); // Estimate entry height

        // Check if we need a new page
        if (yPos + entryHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;
        }

        // Add timestamp and level
        const timestamp = new Date(log.timestamp).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: !use24Hour,
        });

        // Draw log level badge background
        const levelColors: Record<string, string> = {
          error: '#FEE2E2',
          warning: '#FEF3C7',
          info: '#DBEAFE',
          debug: '#F3F4F6',
        };

        const textColors: Record<string, string> = {
          error: '#DC2626',
          warning: '#F59E0B',
          info: '#3B82F6',
          debug: '#6B7280',
        };

        const levelWidth = doc.getTextWidth(log.level.toUpperCase()) + 10;
        doc.setFillColor(levelColors[log.level] || '#F3F4F6');
        doc.roundedRect(margin, yPos - 4, levelWidth, lineHeight + 4, 1, 1, 'F');

        // Add log level text
        doc.setTextColor(textColors[log.level] || '#6B7280');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(log.level.toUpperCase(), margin + 5, yPos);

        // Add timestamp
        doc.setTextColor('#6B7280');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(timestamp, margin + levelWidth + 10, yPos);

        // Add category if present
        if (log.category) {
          const categoryX = margin + levelWidth + doc.getTextWidth(timestamp) + 20;
          doc.setFillColor('#F3F4F6');

          const categoryWidth = doc.getTextWidth(log.category) + 10;
          doc.roundedRect(categoryX, yPos - 4, categoryWidth, lineHeight + 4, 2, 2, 'F');
          doc.setTextColor('#6B7280');
          doc.text(log.category, categoryX + 5, yPos);
        }

        yPos += lineHeight * 1.5;

        // Add message
        doc.setTextColor('#111827');
        doc.setFontSize(10);

        const messageLines = doc.splitTextToSize(log.message, maxLineWidth - 10);
        doc.text(messageLines, margin + 5, yPos);
        yPos += messageLines.length * lineHeight;

        // Add details if present
        if (log.details) {
          doc.setTextColor('#6B7280');
          doc.setFontSize(8);

          const detailsStr = JSON.stringify(log.details, null, 2);
          const detailsLines = doc.splitTextToSize(detailsStr, maxLineWidth - 15);

          // Add details background
          doc.setFillColor('#F9FAFB');
          doc.roundedRect(margin + 5, yPos - 2, maxLineWidth - 10, detailsLines.length * lineHeight + 8, 1, 1, 'F');

          doc.text(detailsLines, margin + 10, yPos + 4);
          yPos += detailsLines.length * lineHeight + 10;
        }

        // Add separator line
        doc.setDrawColor('#E5E7EB');
        doc.setLineWidth(0.1);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += lineHeight * 1.5;
      };

      // Add all logs
      filteredLogs.forEach((log) => {
        addLogEntry(log);
      });

      // Add footer to all pages
      const totalPages = doc.internal.pages.length - 1;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#9CA3AF');

        // Add page numbers
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
          align: 'center',
        });

        // Add footer text
        doc.text('Generated by bolt.diy', margin, doc.internal.pageSize.getHeight() - 10);

        const dateStr = new Date().toLocaleDateString();
        doc.text(dateStr, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      // Save the PDF
      doc.save(`bolt-event-logs-${new Date().toISOString()}.pdf`);
      toast.success('Event logs exported successfully as PDF');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('Failed to export event logs as PDF');
    }
  };

  const exportAsText = () => {
    try {
      const textContent = filteredLogs
        .map((log) => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          let content = `[${timestamp}] ${log.level.toUpperCase()}: ${log.message}\n`;

          if (log.category) {
            content += `Category: ${log.category}\n`;
          }

          if (log.details) {
            content += `Details:\n${JSON.stringify(log.details, null, 2)}\n`;
          }

          return content + '-'.repeat(80) + '\n';
        })
        .join('\n');

      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-event-logs-${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Event logs exported successfully as text file');
    } catch (error) {
      console.error('Failed to export text file:', error);
      toast.error('Failed to export event logs as text file');
    }
  };

  const exportFormats: ExportFormat[] = [
    {
      id: 'json',
      label: 'Export as JSON',
      icon: 'i-ph:file-js',
      handler: exportAsJSON,
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
              Export Event Logs
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

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <DropdownMenu.Root open={showLevelFilter} onOpenChange={setShowLevelFilter}>
          <DropdownMenu.Trigger asChild>
            <button
              className={classNames(
                'flex items-center gap-2',
                'rounded-lg px-3 py-1.5',
                'text-sm text-gray-900 dark:text-white',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
                'transition-all duration-200',
              )}
            >
              <span
                className={classNames('text-lg', selectedLevelOption?.icon || 'i-ph:funnel')}
                style={{ color: selectedLevelOption?.color }}
              />
              {selectedLevelOption?.label || 'All Types'}
              <span className="i-ph:caret-down text-lg text-gray-500 dark:text-gray-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-white dark:bg-[#0A0A0A] rounded-lg shadow-lg py-1 z-[250] animate-in fade-in-0 zoom-in-95 border border-[#E5E5E5] dark:border-[#1A1A1A]"
              sideOffset={5}
              align="start"
              side="bottom"
            >
              {logLevelOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  className="group flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-500/10 dark:hover:bg-purple-500/20 cursor-pointer transition-colors"
                  onClick={() => handleLevelFilterChange(option.value)}
                >
                  <div className="mr-3 flex h-5 w-5 items-center justify-center">
                    <div
                      className={classNames(option.icon, 'text-lg group-hover:text-purple-500 transition-colors')}
                      style={{ color: option.color }}
                    />
                  </div>
                  <span className="group-hover:text-purple-500 transition-colors">{option.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showTimestamps}
              onCheckedChange={(value) => handlePreferenceChange('timestamps', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">Show Timestamps</span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={use24Hour}
              onCheckedChange={(value) => handlePreferenceChange('24hour', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">24h Time</span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={autoExpand}
              onCheckedChange={(value) => handlePreferenceChange('autoExpand', value)}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">Auto Expand</span>
          </div>

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={handleRefresh}
            className={classNames(
              'group flex items-center gap-2',
              'rounded-lg px-3 py-1.5',
              'text-sm text-gray-900 dark:text-white',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
              'transition-all duration-200',
              { 'animate-spin': isRefreshing },
            )}
          >
            <span className="i-ph:arrows-clockwise text-lg text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
            Refresh
          </button>

          <ExportButton />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={classNames(
              'w-full px-4 py-2 pl-10 rounded-lg',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500',
              'transition-all duration-200',
            )}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="i-ph:magnifying-glass text-lg text-gray-500 dark:text-gray-400" />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={classNames(
              'flex flex-col items-center justify-center gap-4',
              'rounded-lg p-8 text-center',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            )}
          >
            <span className="i-ph:clipboard-text text-4xl text-gray-400 dark:text-gray-600" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">No Logs Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
            </div>
          </motion.div>
        ) : (
          filteredLogs.map((log) => (
            <LogEntryItem
              key={log.id}
              log={log}
              isExpanded={autoExpand}
              use24Hour={use24Hour}
              showTimestamp={showTimestamps}
            />
          ))
        )}
      </div>
    </div>
  );
}

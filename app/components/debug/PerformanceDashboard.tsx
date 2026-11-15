/**
 * Performance Dashboard
 * Displays real-time performance metrics and statistics
 * Accessible via debug menu or keyboard shortcut
 */

import { useEffect, useState } from 'react';
import { FrameRateMonitor } from '~/utils/frame-rate-monitor';
import { PerformanceMonitor } from '~/utils/performance-monitor';

interface JourneyStats {
  name: string;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export function PerformanceDashboard({ onClose }: { onClose?: () => void }) {
  const [journeys, setJourneys] = useState<JourneyStats[]>([]);
  const [fps, setFps] = useState(0);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [isMonitoringFps, setIsMonitoringFps] = useState(false);

  useEffect(() => {
    loadJourneyStats();
  }, []);

  useEffect(() => {
    let monitor: FrameRateMonitor | null = null;

    if (isMonitoringFps) {
      monitor = new FrameRateMonitor(60, (newFps, newDroppedFrames) => {
        setFps(newFps);
        setDroppedFrames(newDroppedFrames);
      });
      monitor.start();
    }

    return () => {
      monitor?.stop();
    };
  }, [isMonitoringFps]);

  const loadJourneyStats = () => {
    const journeyNames = PerformanceMonitor.getJourneyNames();

    const stats = journeyNames
      .map((name) => {
        const stat = PerformanceMonitor.getJourneyStats(name);
        return stat ? { name, ...stat } : null;
      })
      .filter((s): s is JourneyStats => s !== null)
      .sort((a, b) => b.count - a.count);

    setJourneys(stats);
  };

  const handleExport = () => {
    const data = PerformanceMonitor.exportEvents();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bolt-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Clear all performance data?')) {
      PerformanceMonitor.clearEvents();
      loadJourneyStats();
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) {
      return `${ms.toFixed(2)}ms`;
    }

    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }

    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceRating = (duration: number, journey: string): 'good' | 'needs-improvement' | 'poor' => {
    // Define performance budgets for different journey types
    const budgets: Record<string, number> = {
      'page-load': 3000,
      'chat-init': 500,
      'message-send': 300,
      'file-load': 1000,
      'code-highlight': 100,
      'web-vital-fcp': 1800,
      'web-vital-lcp': 2500,
      'web-vital-fid': 100,
      'web-vital-cls': 0.1,
    };

    const budget = budgets[journey] || 1000;

    if (duration <= budget * 0.75) {
      return 'good';
    }

    if (duration <= budget) {
      return 'needs-improvement';
    }

    return 'poor';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">⚡ Performance Dashboard</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMonitoringFps(!isMonitoringFps)}
              className="px-3 py-1 text-sm rounded bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover"
            >
              {isMonitoringFps ? 'Stop FPS Monitor' : 'Start FPS Monitor'}
            </button>
            <button
              onClick={loadJourneyStats}
              className="px-3 py-1 text-sm rounded bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 text-sm rounded bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover"
            >
              Export
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-sm rounded bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm rounded bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover"
            >
              Close
            </button>
          </div>
        </div>

        {/* FPS Monitor */}
        {isMonitoringFps && (
          <div className="p-4 bg-bolt-elements-bg-depth-2 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-sm text-bolt-elements-textSecondary">Current FPS</div>
                <div className="text-2xl font-bold text-bolt-elements-textPrimary">{fps}</div>
              </div>
              <div>
                <div className="text-sm text-bolt-elements-textSecondary">Dropped Frames</div>
                <div className="text-2xl font-bold text-bolt-elements-textPrimary">{droppedFrames}</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-bolt-elements-textSecondary mb-1">Performance</div>
                <div className="h-2 bg-bolt-elements-bg-depth-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      fps >= 55 ? 'bg-green-500' : fps >= 45 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(fps / 60) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Journey Stats */}
        <div className="flex-1 overflow-auto p-4">
          {journeys.length === 0 ? (
            <div className="text-center py-12 text-bolt-elements-textSecondary">
              No performance data collected yet. Start using the app to see metrics.
            </div>
          ) : (
            <div className="space-y-4">
              {journeys.map((journey) => {
                const rating = getPerformanceRating(journey.p75, journey.name);

                const ratingColor =
                  rating === 'good'
                    ? 'text-green-500'
                    : rating === 'needs-improvement'
                      ? 'text-yellow-500'
                      : 'text-red-500';

                return (
                  <div
                    key={journey.name}
                    className="bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-bolt-elements-textPrimary">{journey.name}</h3>
                      <span className="text-sm text-bolt-elements-textSecondary">{journey.count} samples</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">Min</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.min)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">Avg</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.avg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">P50</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.p50)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">P75</div>
                        <div className={`text-sm font-mono font-bold ${ratingColor}`}>
                          {formatDuration(journey.p75)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">P95</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.p95)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">P99</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.p99)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-bolt-elements-textSecondary">Max</div>
                        <div className="text-sm font-mono text-bolt-elements-textPrimary">
                          {formatDuration(journey.max)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2">
          <p className="text-sm text-bolt-elements-textSecondary">
            Performance data is stored locally in your browser. Export to save or share with the team.
          </p>
        </div>
      </div>
    </div>
  );
}

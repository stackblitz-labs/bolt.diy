import { useEffect, useState } from 'react';
import { performanceMonitor } from '~/lib/performance/metrics';

/**
 * Performance Monitor Component
 * Shows real-time performance metrics in development
 * Access via: window.__BOLT_PERFORMANCE__.report()
 */
export function PerformanceMonitor() {
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<string>('');

  useEffect(() => {
    // Only show in development
    if (import.meta.env.PROD) {
      return () => undefined;
    }

    // Listen for Ctrl+Shift+P to toggle
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setVisible((v) => !v);

        if (!visible) {
          setMetrics(performanceMonitor.generateReport());
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [visible]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (visible) {
      interval = setInterval(() => {
        setMetrics(performanceMonitor.generateReport());
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [visible]);

  if (!visible || import.meta.env.PROD) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg p-4 shadow-lg max-w-lg max-h-96 overflow-auto z-50"
      style={{ fontFamily: 'monospace', fontSize: '12px' }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-bolt-elements-textPrimary">Performance Metrics</h3>
        <button
          onClick={() => setVisible(false)}
          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
        >
          ✕
        </button>
      </div>
      <pre className="text-bolt-elements-textSecondary whitespace-pre-wrap">{metrics}</pre>
      <div className="mt-2 text-xs text-bolt-elements-textTertiary">
        Press Ctrl+Shift+P to toggle • Console: window.__BOLT_PERFORMANCE__
      </div>
    </div>
  );
}

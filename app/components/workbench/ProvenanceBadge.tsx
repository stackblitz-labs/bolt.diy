/**
 * Provenance Badge Component
 *
 * Displays data source provenance with tooltips and accessibility support.
 * Shows icons for Maps, Website, and Social sources with timestamps.
 *
 * Based on specs/001-places-crawler/tasks.md Task T014 (FR-011 compliance)
 *
 * @module ProvenanceBadge
 */

import { useRef, useState } from 'react';
import { createProvenanceBadge, type SectionType, type SourceUsed } from '~/lib/services/crawlerAgent.schema';

interface ProvenanceBadgeProps {
  section: SectionType;
  sources: SourceUsed[];
  className?: string;
}

/**
 * Icon component for source types
 */
function SourceIcon({ type }: { type: SourceUsed['type'] }) {
  switch (type) {
    case 'maps':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );

    case 'website':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      );

    case 'social':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      );
  }
}

/**
 * Get human-readable source type label
 */
function getSourceLabel(type: SourceUsed['type']): string {
  const labels = {
    maps: 'Google Maps',
    website: 'Website',
    social: 'Social Media',
  };
  return labels[type];
}

/**
 * Provenance Badge Component
 *
 * FR-011 Accessibility Requirements:
 * - Keyboard focusable
 * - ARIA labels for screen readers
 * - Tooltips with hover/focus states
 */
export function ProvenanceBadge({ section, sources, className = '' }: ProvenanceBadgeProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [touchedIndex, setTouchedIndex] = useState<number | null>(null);
  const badgeRefs = useRef<Array<HTMLDivElement | null>>([]);

  const shouldFlipTooltip = (index: number): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }

    const node = badgeRefs.current[index];

    if (!node) {
      return false;
    }

    const rect = node.getBoundingClientRect();

    return rect.top < 100;
  };

  if (sources.length === 0) {
    return null;
  }

  // Create badge data (not used directly, but validates inputs)
  createProvenanceBadge(section, sources);

  return (
    <div
      className={`provenance-badge-container inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={`Data sources for ${section} section`}
    >
      {sources.map((source, idx) => {
        const timestamp = new Date(source.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        const boundedConfidence =
          typeof source.confidence === 'number' ? Math.min(1, Math.max(0, source.confidence)) : null;
        const confidenceText =
          boundedConfidence !== null ? ` (${Math.round(boundedConfidence * 100)}% confidence)` : '';

        const tooltipText = `${getSourceLabel(source.type)} • ${timestamp}${confidenceText}`;
        const isTooltipVisible = hoveredIndex === idx || touchedIndex === idx;
        const shouldFlip = isTooltipVisible && shouldFlipTooltip(idx);
        const tooltipPositionClass = shouldFlip ? 'top-full mt-2' : 'bottom-full mb-2';
        const arrowWrapperClass = shouldFlip
          ? 'absolute bottom-full left-1/2 -translate-x-1/2 -mb-px'
          : 'absolute top-full left-1/2 -translate-x-1/2 -mt-px';
        const arrowClass = shouldFlip
          ? 'border-4 border-transparent border-b-bolt-elements-background-depth-1'
          : 'border-4 border-transparent border-t-bolt-elements-background-depth-1';
        const key = `${source.type}-${source.timestamp}-${boundedConfidence ?? 'na'}`;

        return (
          <div
            key={key}
            className="relative inline-flex"
            ref={(el) => {
              badgeRefs.current[idx] = el;
            }}
          >
            <button
              type="button"
              className="provenance-badge inline-flex items-center justify-center p-1.5 rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(idx)}
              onBlur={() => {
                setHoveredIndex(null);
                setTouchedIndex(null);
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                setTouchedIndex((current) => (current === idx ? null : idx));
              }}
              aria-label={`${section} data sourced from ${getSourceLabel(source.type)} on ${timestamp}`}
              title={tooltipText}
              tabIndex={0}
            >
              <SourceIcon type={source.type} />
              <span className="sr-only">{getSourceLabel(source.type)}</span>
            </button>

            {/* Tooltip */}
            {isTooltipVisible && (
              <div
                className={`absolute ${tooltipPositionClass} left-1/2 -translate-x-1/2 px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-lg text-xs text-bolt-elements-textPrimary whitespace-nowrap z-50 pointer-events-none`}
                role="tooltip"
              >
                <div className="font-medium">{getSourceLabel(source.type)}</div>
                <div className="text-bolt-elements-textSecondary">{timestamp}</div>
                {boundedConfidence !== null && (
                  <div className="text-bolt-elements-textTertiary">
                    {Math.round(boundedConfidence * 100)}% confidence
                  </div>
                )}
                {/* Arrow */}
                <div className={arrowWrapperClass}>
                  <div className={arrowClass} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

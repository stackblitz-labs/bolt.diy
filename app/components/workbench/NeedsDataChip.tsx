/**
 * Needs Data Chip Component
 *
 * Displays actionable chips for missing data sections with keyboard accessibility.
 * Allows users to request specific data via conversational prompts.
 *
 * Based on specs/001-places-crawler/tasks.md Task T014 (FR-011 compliance)
 *
 * @module NeedsDataChip
 */

import { createNeedsDataChip, type SectionType } from '~/lib/services/crawlerAgent.schema';

interface NeedsDataChipProps {
  section: SectionType;
  guidance?: string;
  onRequest: (section: SectionType) => void;
  className?: string;
}

/**
 * Get section-specific icon
 */
function SectionIcon({ section }: { section: SectionType }) {
  const iconClass = 'w-4 h-4';

  switch (section) {
    case 'identity':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
          />
        </svg>
      );

    case 'contact':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      );

    case 'hours':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );

    case 'menu':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );

    case 'reviews':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      );

    case 'media':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
  }
}

/**
 * Needs Data Chip Component
 *
 * FR-011 Accessibility Requirements:
 * - Keyboard navigable (Tab/Shift+Tab)
 * - Enter/Space activation
 * - ARIA labels for screen readers
 * - Focus indicators
 */
export function NeedsDataChip({ section, guidance, onRequest, className = '' }: NeedsDataChipProps) {
  const chip = createNeedsDataChip(section, guidance);

  const handleClick = () => {
    onRequest(section);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRequest(section);
    }
  };

  return (
    <button
      type="button"
      className={`needs-data-chip inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-bolt-elements-background-depth-1 ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={chip.ariaLabel}
      role="button"
      tabIndex={0}
    >
      {/* Warning Icon */}
      <span className="warning-icon flex-shrink-0" aria-hidden="true">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </span>

      {/* Section Icon */}
      <SectionIcon section={section} />

      {/* Label */}
      <span className="font-medium text-sm">{chip.label}</span>

      {/* Guidance (if provided) */}
      {chip.guidance && (
        <span className="chip-guidance text-xs opacity-80 border-l border-current/30 pl-2 ml-1" aria-live="polite">
          {chip.guidance}
        </span>
      )}

      {/* Chevron indicator */}
      <svg className="w-4 h-4 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * Needs Data Chip List Component
 *
 * Displays multiple chips in a responsive grid layout
 */
interface NeedsDataChipListProps {
  missingSections: SectionType[];
  onRequest: (section: SectionType) => void;
  className?: string;
}

export function NeedsDataChipList({ missingSections, onRequest, className = '' }: NeedsDataChipListProps) {
  if (missingSections.length === 0) {
    return null;
  }

  return (
    <div
      className={`needs-data-chip-list flex flex-wrap gap-2 ${className}`}
      role="list"
      aria-label="Missing data sections"
    >
      {missingSections.map((section) => (
        <div key={section} role="listitem">
          <NeedsDataChip section={section} onRequest={onRequest} />
        </div>
      ))}
    </div>
  );
}

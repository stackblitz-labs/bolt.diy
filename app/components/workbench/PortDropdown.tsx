import { memo, useEffect, useRef } from 'react';
import type { PreviewInfo } from '~/lib/stores/previews';

interface PortDropdownProps {
  activePreviewIndex: number;
  setActivePreviewIndex: (index: number) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (value: boolean) => void;
  setHasSelectedPreview: (value: boolean) => void;
  previews: PreviewInfo[];
}

export const PortDropdown = memo(
  ({
    activePreviewIndex,
    setActivePreviewIndex,
    isDropdownOpen,
    setIsDropdownOpen,
    setHasSelectedPreview,
    previews,
  }: PortDropdownProps) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    // sort previews, preserving original index
    const sortedPreviews = previews
      .map((previewInfo, index) => ({ ...previewInfo, index }))
      .sort((a, b) => a.port - b.port);

    // close dropdown if user clicks outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      if (isDropdownOpen) {
        window.addEventListener('mousedown', handleClickOutside);
      } else {
        window.removeEventListener('mousedown', handleClickOutside);
      }

      return () => {
        window.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isDropdownOpen]);

    return (
      <div className="relative z-port-dropdown" ref={dropdownRef}>
        {/* Display the active port if available, otherwise show the plug icon */}
        <button
          className="flex items-center group-focus-within:text-bolt-elements-preview-addressBar-text bg-white group-focus-within:bg-bolt-elements-preview-addressBar-background dark:bg-bolt-elements-preview-addressBar-backgroundHover rounded-full px-2 py-1 gap-1.5"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span className="i-ph:plug text-base"></span>
          {previews.length > 0 && activePreviewIndex >= 0 && activePreviewIndex < previews.length ? (
            <span className="text-xs font-medium">{previews[activePreviewIndex].port}</span>
          ) : null}
        </button>
        {isDropdownOpen && (
          <div className="absolute left-0 mt-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded shadow-sm min-w-[140px] dropdown-animation">
            <div className="px-4 py-2 border-b border-bolt-elements-borderColor text-sm font-semibold text-bolt-elements-textPrimary">
              Ports
            </div>
            {sortedPreviews.map((preview) => (
              <div
                key={preview.port}
                className="flex items-center px-4 py-2 cursor-pointer hover:bg-bolt-elements-item-backgroundActive"
                onClick={() => {
                  setActivePreviewIndex(preview.index);
                  setIsDropdownOpen(false);
                  setHasSelectedPreview(true);
                }}
              >
                <span
                  className={
                    activePreviewIndex === preview.index
                      ? 'text-bolt-elements-item-contentAccent'
                      : 'text-bolt-elements-item-contentDefault group-hover:text-bolt-elements-item-contentActive'
                  }
                >
                  {preview.port}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

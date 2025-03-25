import React from 'react';
import type { WebSearchResult } from '~/lib/hooks/useWebSearch';
import { IconButton } from '~/components/ui/IconButton';

interface WebSearchResultsProps {
  results: WebSearchResult | null;
  onClose?: () => void;
}

export const WebSearchResults: React.FC<WebSearchResultsProps> = ({ results, onClose }) => {
  if (!results || results.data.length === 0) {
    return null;
  }

  return (
    <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-4 mb-4 max-w-full overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-md font-medium flex items-center gap-2">
          <span className="i-ph:magnifying-glass text-bolt-elements-textSecondary" />
          Search results for: <span className="font-bold">{results.query}</span>
        </h3>
        {onClose && (
          <IconButton
            onClick={onClose}
            title="Close search results"
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-text"
          >
            <div className="i-ph:x" />
          </IconButton>
        )}
      </div>

      {results.error ? (
        <div className="text-bolt-elements-textError p-2">{results.error}</div>
      ) : (
        <div className="space-y-3 mt-2 max-h-96 overflow-y-auto pr-2">
          {results.data.map((item, index) => (
            <div key={index} className="border-b border-bolt-elements-borderColor pb-3 last:border-0">
              <h4 className="font-medium text-bolt-elements-textAccent mb-1">{item.title}</h4>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-bolt-elements-textLink hover:underline block truncate mb-1"
              >
                {item.link}
              </a>
              <p className="text-sm text-bolt-elements-textSecondary">{item.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';

interface WebSearchBarProps {
  onSearch?: (query: string) => void;
  isSearching?: boolean;
  handleInputChange?: (query: string) => void;
}

// Notification indicator component with proper typing
const NotificationDot: React.FC = () => (
  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bolt-elements-textAccent opacity-30"></span>
    <span className="relative inline-flex rounded-full h-2 w-2 bg-bolt-elements-textAccent"></span>
  </span>
);

export const WebSearchBar: React.FC<WebSearchBarProps> = ({ onSearch, isSearching = false, handleInputChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (query.trim()) {
      if (handleInputChange) {
        // Format the query as a @search command and update the input field
        handleInputChange(`@search ${query.trim()}`);

        // Show a toast to guide the user
        toast.info('Search query added to chat. Press Enter to execute the search.', { autoClose: 3000 });
      } else if (onSearch) {
        // Fallback to original behavior if handleInputChange is not provided
        onSearch(query.trim());
      }

      setQuery('');
      setIsExpanded(false);
    }
  };

  // Determine if we should show the notification dot
  const showNotificationDot = !isExpanded && !isSearching;

  return (
    <div className="relative">
      <IconButton
        title={
          isExpanded ? 'Close search' : 'Web search for factual information, technical help, or error troubleshooting'
        }
        className="text-bolt-elements-textSecondary hover:text-bolt-elements-text transition-all web-search-bar-toggle relative"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={isSearching ? 'i-svg-spinners:90-ring-with-bg animate-spin' : 'i-ph:magnifying-glass'} />
      </IconButton>

      {/* Render the notification dot outside the IconButton */}
      {showNotificationDot && <NotificationDot />}

      {isExpanded && (
        <>
          <form
            onSubmit={handleSearch}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-[calc(100%+0.5rem)] flex flex-col items-center bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md overflow-hidden shadow-md z-50"
          >
            <div className="flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for information, technical help, or errors..."
                className="px-3 py-2 bg-transparent outline-none w-64 text-sm"
                autoFocus
              />
              <IconButton
                title="Search (adds @search to input field - press Enter to execute)"
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-text mx-1"
                disabled={isSearching || !query.trim()}
                onClick={handleSearch}
              >
                <div className={isSearching ? 'i-svg-spinners:90-ring-with-bg animate-spin' : 'i-ph:arrow-right'} />
              </IconButton>
            </div>
            <div className="text-xs text-bolt-elements-textSecondary p-2 text-center w-full bg-bolt-elements-background-depth-3">
              Type your search query above or click the arrow to search
            </div>
          </form>
          <div className="absolute left-0 top-full mt-2 text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 p-2 rounded-md border border-bolt-elements-borderColor shadow-sm z-50">
            <p>1. Enter search term and click the arrow</p>
            <p>2. Press Enter to execute the search</p>
            <p>3. Results will be sent to the chat</p>
          </div>
        </>
      )}
    </div>
  );
};

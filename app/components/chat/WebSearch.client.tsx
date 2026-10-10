import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Checkbox } from '~/components/ui/Checkbox';
import { IconButton } from '~/components/ui/IconButton';
import type { WebPageContent, WebSearchApiResponse, WebSearchResponseData } from '~/types/web-search';
import { classNames } from '~/utils/classNames';
import { isValidUrl } from '~/utils/url';
import { formatPageContent, formatSearchResults } from '~/utils/webSearchFormat';

interface WebSearchProps {
  onSearchResult: (result: string) => void;
  disabled?: boolean;
}

const DEFAULT_SELECTED_RESULTS = 3;

async function callWebSearchApi(body: { url: string } | { query: string }) {
  const response = await fetch('/api/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as WebSearchApiResponse;

  if (!response.ok || !result.success) {
    throw new Error(('error' in result && result.error) || 'Web search failed');
  }

  return result;
}

async function fetchPage(url: string): Promise<WebPageContent> {
  const result = await callWebSearchApi({ url });

  if (result.type !== 'page') {
    throw new Error('Unexpected response from web search');
  }

  return result.data;
}

/** Looks like a URL the user meant to fetch, e.g. "https://x.dev" or "x.dev/docs". */
function toFetchableUrl(input: string): string | null {
  if (isValidUrl(input)) {
    return input;
  }

  if (!/\s/.test(input) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(input) && isValidUrl(`https://${input}`)) {
    return `https://${input}`;
  }

  return null;
}

export function WebSearch({ onSearchResult, disabled = false }: WebSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [input, setInput] = useState('');
  const [searchData, setSearchData] = useState<WebSearchResponseData | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [includePageContent, setIncludePageContent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const reset = () => {
    setInput('');
    setSearchData(null);
    setSelectedUrls(new Set());
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();

    if (!trimmed || isBusy) {
      return;
    }

    setIsBusy(true);

    try {
      const url = toFetchableUrl(trimmed);

      if (url) {
        onSearchResult(formatPageContent(await fetchPage(url)));
        toast.success('URL content added to your prompt');
        reset();

        return;
      }

      const result = await callWebSearchApi({ query: trimmed });

      if (result.type !== 'search') {
        throw new Error('Unexpected response from web search');
      }

      if (result.data.results.length === 0) {
        toast.info('No results found, try a different search');
        return;
      }

      setSearchData(result.data);
      setSelectedUrls(new Set(result.data.results.slice(0, DEFAULT_SELECTED_RESULTS).map((r) => r.url)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Web search failed');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleSelected = (url: string, checked: boolean) => {
    setSelectedUrls((previous) => {
      const next = new Set(previous);

      if (checked) {
        next.add(url);
      } else {
        next.delete(url);
      }

      return next;
    });
  };

  const handleAddResults = async () => {
    if (!searchData || selectedUrls.size === 0 || isBusy) {
      return;
    }

    const selected = searchData.results.filter((result) => selectedUrls.has(result.url));
    const pageContents: Record<string, WebPageContent> = {};

    setIsBusy(true);

    try {
      if (includePageContent) {
        // Some sites block bots; fall back to the snippet for those
        const pages = await Promise.allSettled(selected.map((result) => fetchPage(result.url)));

        let failed = 0;

        pages.forEach((page, index) => {
          if (page.status === 'fulfilled') {
            pageContents[selected[index].url] = page.value;
          } else {
            failed++;
          }
        });

        if (failed > 0) {
          toast.warn(`Couldn't fetch ${failed} of ${selected.length} pages, using their snippets instead`);
        }
      }

      onSearchResult(formatSearchResults(searchData.query, selected, pageContents));
      toast.success(`Added ${selected.length} search result${selected.length === 1 ? '' : 's'} to your prompt`);
      reset();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        title="Search the web or fetch a URL"
        disabled={disabled || isBusy}
        onClick={() => setIsOpen(!isOpen)}
        className="transition-all"
      >
        {isBusy ? (
          <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin" />
        ) : (
          <div className="i-ph:globe text-xl" />
        )}
      </IconButton>
      {isOpen && (
        <div
          className={classNames(
            'absolute bottom-full left-0 mb-2 z-50 flex flex-col gap-2 w-[420px] max-w-[calc(100vw-2rem)]',
            'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 shadow-lg',
          )}
        >
          {searchData && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 text-xs text-bolt-elements-textSecondary">
                <span>
                  {searchData.results.length} results for “{searchData.query}”
                </span>
                <span className="text-bolt-elements-textTertiary">via {searchData.provider}</span>
              </div>
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {searchData.results.map((result) => {
                  const id = `web-search-result-${encodeURIComponent(result.url)}`;

                  return (
                    <li key={result.url}>
                      <label
                        htmlFor={id}
                        className="flex cursor-pointer gap-2 rounded-md p-2 hover:bg-bolt-elements-background-depth-3"
                      >
                        <Checkbox
                          id={id}
                          className="mt-0.5"
                          checked={selectedUrls.has(result.url)}
                          onCheckedChange={(checked) => toggleSelected(result.url, checked === true)}
                          disabled={isBusy}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium text-bolt-elements-textPrimary">
                            {result.title}
                          </span>
                          <span className="truncate text-xs text-bolt-elements-textTertiary">{result.url}</span>
                          {result.snippet && (
                            <span className="line-clamp-2 text-xs text-bolt-elements-textSecondary">
                              {result.snippet}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-2 px-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-bolt-elements-textSecondary">
                  <Checkbox
                    checked={includePageContent}
                    onCheckedChange={(checked) => setIncludePageContent(checked === true)}
                    disabled={isBusy}
                  />
                  Include full page content
                </label>
                <button
                  onClick={handleAddResults}
                  disabled={isBusy || selectedUrls.size === 0}
                  className={classNames(
                    'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap',
                    'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
                    'hover:bg-bolt-elements-button-primary-backgroundHover',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {isBusy ? 'Adding...' : `Add ${selectedUrls.size} to prompt`}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              aria-label="Search the web or paste a URL"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }

                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder="Search the web or paste a URL"
              disabled={isBusy}
              className={classNames(
                'flex-1 min-w-0 px-3 py-1.5 text-sm rounded-md',
                'border border-bolt-elements-borderColor',
                'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary',
                'placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
              )}
            />
            <button
              onClick={handleSubmit}
              disabled={isBusy || !input.trim()}
              className={classNames(
                'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap',
                'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
                'hover:bg-bolt-elements-button-primary-backgroundHover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isBusy && !searchData ? 'Searching...' : toFetchableUrl(input.trim()) ? 'Fetch' : 'Search'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

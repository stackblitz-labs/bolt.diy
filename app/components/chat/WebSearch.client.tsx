import { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';

interface WebSearchProps {
  onSearchResult: (result: string) => void;
  disabled?: boolean;
}

interface WebSearchResponse {
  success: boolean;
  data?: {
    title: string;
    description: string;
    mainContent: string;
    codeBlocks: string[];
    relevantLinks: Array<{
      url: string;
      text: string;
    }>;
    sourceUrl: string;
  };
  error?: string;
}

export const WebSearch = ({ onSearchResult, disabled = false }: WebSearchProps) => {
  const [isSearching, setIsSearching] = useState(false);

  const formatSearchResult = (data: WebSearchResponse['data']) => {
    if (!data) {
      return '';
    }

    let result = `# Web Search Results from ${data.sourceUrl}\n\n`;
    result += `## ${data.title}\n\n`;

    if (data.description) {
      result += `**Description:** ${data.description}\n\n`;
    }

    result += `**Main Content:**\n${data.mainContent}\n\n`;

    if (data.codeBlocks.length > 0) {
      result += `## Code Examples\n\n`;
      data.codeBlocks.forEach((block, _index) => {
        result += `\`\`\`\n${block}\n\`\`\`\n\n`;
      });
    }

    if (data.relevantLinks.length > 0) {
      result += `## Relevant Links\n\n`;
      data.relevantLinks.forEach((link) => {
        result += `- [${link.text}](${link.url})\n`;
      });
    }

    return result;
  };

  const handleWebSearch = async () => {
    if (disabled) {
      return;
    }

    try {
      setIsSearching(true);

      const url = window.prompt('Enter URL to search:');

      if (!url) {
        setIsSearching(false);
        return;
      }

      const formData = new FormData();
      formData.append('url', url);

      const response = await fetch('/api-web-search', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as WebSearchResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform web search');
      }

      if (!data.data) {
        throw new Error('No data received from web search');
      }

      const formattedResult = formatSearchResult(data.data);
      onSearchResult(formattedResult);
      toast.success('Web search completed successfully');
    } catch (error) {
      console.error('Web search error:', error);
      toast.error('Failed to perform web search: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <IconButton
      title="Web Search"
      disabled={disabled || isSearching}
      onClick={handleWebSearch}
      className="transition-all"
    >
      {isSearching ? (
        <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
      ) : (
        <div className="i-ph:globe text-xl"></div>
      )}
    </IconButton>
  );
};

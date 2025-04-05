import { useState, useEffect, type PropsWithChildren } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ThoughtBox');

const ThoughtBox = ({ title, children }: PropsWithChildren<{ title: string }>) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [processedContent, setProcessedContent] = useState<React.ReactNode>(children);

  // Process content to handle potential formatting issues
  useEffect(() => {
    try {
      // If children is a string and contains XML tags, clean them up
      if (typeof children === 'string') {
        let content = children;

        // Remove any remaining think tags that might have slipped through
        content = content.replace(/<\/?think>/g, '');

        // Handle potential escaped XML (common with Anthropic output)
        content = content.replace(/&lt;think&gt;|&lt;\/think&gt;/g, '');

        setProcessedContent(content);
      } else {
        setProcessedContent(children);
      }
    } catch (error) {
      logger.error('Error processing thought content:', error);
      setProcessedContent(children);
    }
  }, [children]);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className={`
        bg-bolt-elements-background-depth-2
        shadow-md 
        rounded-lg 
        cursor-pointer 
        transition-all 
        duration-300
        ${isExpanded ? 'max-h-96' : 'max-h-13'}
        overflow-auto
        border border-bolt-elements-borderColor
      `}
    >
      <div className="p-4 flex items-center gap-4 rounded-lg text-bolt-elements-textSecondary font-medium leading-5 text-sm border border-bolt-elements-borderColor">
        <div className="i-ph:brain-thin text-2xl" />
        <div className="div">
          <span> {title}</span>{' '}
          {!isExpanded && <span className="text-bolt-elements-textTertiary"> - Click to expand</span>}
        </div>
      </div>
      <div
        className={`
        transition-opacity 
        duration-300
        p-4 
        rounded-lg 
        ${isExpanded ? 'opacity-100' : 'opacity-0'}
      `}
      >
        {processedContent}
      </div>
    </div>
  );
};

export default ThoughtBox;

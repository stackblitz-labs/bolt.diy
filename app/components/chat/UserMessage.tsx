/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';

// Function to determine the appropriate icon based on file extension
function getFileIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    // Documents
    case 'md':
    case 'txt':
      return 'i-ph:file-text text-amber-400';
    case 'docx':
      return 'i-ph:file-doc text-blue-500';
    case 'pdf':
      return 'i-ph:file-pdf text-red-500';

    // Default for other types
    default:
      return 'i-ph:file-text text-bolt-elements-textSecondary';
  }
}

interface UserMessageProps {
  content:
    | string
    | Array<{ type: string; text?: string; image?: string; file?: { name: string; type: string; size: number } }>;
}

export function UserMessage({ content }: UserMessageProps) {
  if (Array.isArray(content)) {
    const textItem = content.find((item) => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');
    const images = content.filter((item) => item.type === 'image' && item.image);

    // Extract attached file information from content
    const fileRegex =
      /\[File attached: (.+?) \((\d+) KB\)(?:\s*-\s*([A-Z]+) document)?\]\n\nContent of file .+?:\n```\n([\s\S]*?)\n```/g;
    const docFileRegex =
      /\[File attached: (.+?) \((\d+) KB\) - ([A-Z]+) document\]\n\nExtracted text from .+?:\n```\n([\s\S]*?)\n```/g;

    let matches;
    const textFiles = [];
    let cleanedContent = textContent;

    // Find all occurrences of file information
    while ((matches = fileRegex.exec(textContent)) !== null) {
      const file = {
        name: matches[1],
        size: parseInt(matches[2]),
        type: matches[3] || '', // Can be empty for normal files
      };
      textFiles.push(file);
    }

    // Find PDF/DOCX documents
    while ((matches = docFileRegex.exec(textContent)) !== null) {
      const file = {
        name: matches[1],
        size: parseInt(matches[2]),
        type: matches[3], // DOCX or PDF
      };
      textFiles.push(file);
    }

    // Remove file information from main content - more aggressive to handle markdown
    if (textFiles.length > 0) {
      // Remove content between special markdown markers
      cleanedContent = cleanedContent.replace(
        /<!-- BACKEND_MARKDOWN_CONTENT_START -->[\s\S]*?<!-- BACKEND_MARKDOWN_CONTENT_END -->/g,
        '',
      );

      // Remove normal file information
      cleanedContent = cleanedContent.replace(
        /\n*\[File attached: .+?\n\nContent of file .+?:\n```\n[\s\S]*?\n```\n*/gs,
        '',
      );

      // Remove extracted document information
      cleanedContent = cleanedContent.replace(
        /\n*\[File attached: .+? - [A-Z]+ document\]\n\nExtracted text from .+?:\n```\n[\s\S]*?\n```\n*/gs,
        '',
      );
    }

    return (
      <div className="overflow-hidden pt-[4px]">
        <div className="flex flex-col gap-4">
          {cleanedContent && cleanedContent.trim() !== '' && <Markdown html>{cleanedContent}</Markdown>}

          {textFiles.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {textFiles.map((file, index) => (
                  <div
                    key={`text-file-${index}`}
                    className="flex items-center gap-2 py-1.5 px-2 bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-[75%]"
                  >
                    <div className="flex items-center justify-center w-5 h-5 text-bolt-elements-textSecondary">
                      <div className={getFileIcon(file.name) + ' text-lg'}></div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-medium text-bolt-elements-textPrimary">{file.name}</span>
                      <span className="text-[10px] text-bolt-elements-textTertiary">
                        {file.size} KB {file.type ? `- ${file.type}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {images.map((item, index) => (
            <img
              key={`img-${index}`}
              src={item.image}
              alt={`Image ${index + 1}`}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '512px', objectFit: 'contain' }}
            />
          ))}
        </div>
      </div>
    );
  }

  const textContent = stripMetadata(content);

  // Extract attached file information from content
  const fileRegex =
    /\[File attached: (.+?) \((\d+) KB\)(?:\s*-\s*([A-Z]+) document)?\]\n\nContent of file .+?:\n```\n([\s\S]*?)\n```/g;
  const docFileRegex =
    /\[File attached: (.+?) \((\d+) KB\) - ([A-Z]+) document\]\n\nExtracted text from .+?:\n```\n([\s\S]*?)\n```/g;

  let matches;
  const textFiles = [];
  let cleanedContent = textContent;

  // Find all occurrences of file information for regular files
  while ((matches = fileRegex.exec(textContent)) !== null) {
    const file = {
      name: matches[1],
      size: parseInt(matches[2]),
      type: matches[3] || '', // Can be empty for normal files
    };
    textFiles.push(file);
  }

  // Find PDF/DOCX documents
  while ((matches = docFileRegex.exec(textContent)) !== null) {
    const file = {
      name: matches[1],
      size: parseInt(matches[2]),
      type: matches[3], // DOCX or PDF
    };
    textFiles.push(file);
  }

  // Remove file information from main content
  if (textFiles.length > 0) {
    // Remove content between special markdown markers
    cleanedContent = cleanedContent.replace(
      /<!-- BACKEND_MARKDOWN_CONTENT_START -->[\s\S]*?<!-- BACKEND_MARKDOWN_CONTENT_END -->/g,
      '',
    );

    // Remove normal file information
    cleanedContent = cleanedContent.replace(
      /\n*\[File attached: .+?\n\nContent of file .+?:\n```\n[\s\S]*?\n```\n*/gs,
      '',
    );

    // Remove extracted document information
    cleanedContent = cleanedContent.replace(
      /\n*\[File attached: .+? - [A-Z]+ document\]\n\nExtracted text from .+?:\n```\n[\s\S]*?\n```\n*/gs,
      '',
    );
  }

  return (
    <div className="overflow-hidden pt-[4px]">
      <div className="flex flex-col gap-4">
        {cleanedContent && cleanedContent.trim() !== '' && <Markdown html>{cleanedContent}</Markdown>}

        {textFiles.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {textFiles.map((file, index) => (
                <div
                  key={`text-file-${index}`}
                  className="flex items-center gap-2 py-1.5 px-2 bg-[#1e1e1e] rounded-lg border border-gray-800 max-w-[75%]"
                >
                  <div className="flex items-center justify-center w-5 h-5 text-bolt-elements-textSecondary">
                    <div className={getFileIcon(file.name) + ' text-lg'}></div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-medium text-bolt-elements-textPrimary">{file.name}</span>
                    <span className="text-[10px] text-bolt-elements-textTertiary">
                      {file.size} KB {file.type ? `- ${file.type}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

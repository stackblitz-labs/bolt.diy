/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
}

export function UserMessage({ content }: UserMessageProps) {
  if (Array.isArray(content)) {
    const textItem = content.find((item) => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');
    const images = content.filter((item) => item.type === 'image' && item.image);

    return (
      <div className="overflow-hidden flex items-center">
        <div className="flex flex-col gap-4">
          {textContent && <Markdown html>{textContent}</Markdown>}
          {images.map((item, index) => (
            <img
              key={index}
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

  return (
    <div className="overflow-hidden pt-[4px]">
      <Markdown html>{textContent}</Markdown>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

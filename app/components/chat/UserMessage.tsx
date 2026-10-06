import { useStore } from '@nanostores/react';
import { Markdown } from './Markdown';
import {
  getFileMediaType,
  getFileUrl,
  getMessageText,
  isFilePart,
  type AnyMessage,
  type AnyPart,
} from '~/lib/persistence/messageMigration';
import { profileStore } from '~/lib/stores/profile';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';

interface UserMessageProps {
  content?: unknown;
  parts: AnyPart[] | undefined;
}

export function UserMessage({ content, parts }: UserMessageProps) {
  const profile = useStore(profileStore);

  const images = (parts ?? []).filter(
    (part) => isFilePart(part) && (getFileMediaType(part) ?? '').startsWith('image/'),
  );

  /*
   * One text source for both shapes. v4 messages carry `content`, v5+ carry
   * `parts`, and previously this called stripMetadata(content) directly, which
   * threw a TypeError on undefined once content went away.
   */
  const textContent = stripMetadata(getMessageText({ content, parts } as AnyMessage));

  if (Array.isArray(content)) {
    return (
      <div className="overflow-hidden flex flex-col gap-3 items-center ">
        <div className="flex flex-row items-start justify-center overflow-hidden shrink-0 self-start">
          {profile?.avatar || profile?.username ? (
            <div className="flex items-end gap-2">
              <img
                src={profile.avatar}
                alt={profile?.username || 'User'}
                className="w-[25px] h-[25px] object-cover rounded-full"
                loading="eager"
                decoding="sync"
              />
              <span className="text-bolt-elements-textPrimary text-sm">
                {profile?.username ? profile.username : ''}
              </span>
            </div>
          ) : (
            <div className="i-ph:user-fill text-accent-500 text-2xl" />
          )}
        </div>
        <div className="flex flex-col gap-4 bg-accent-500/10 backdrop-blur-sm p-3 py-3 w-auto rounded-lg mr-auto">
          {textContent && <Markdown html>{textContent}</Markdown>}
          {images.map((item, index) => (
            <img
              key={index}
              src={getFileUrl(item)}
              alt={`Image ${index + 1}`}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '512px', objectFit: 'contain' }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
      <div className="flex gap-3.5 mb-4">
        {images.map((item, index) => (
          <div key={index} className="relative flex rounded-lg border border-bolt-elements-borderColor overflow-hidden">
            <div className="h-16 w-16 bg-transparent outline-none">
              <img
                src={getFileUrl(item)}
                alt={`Image ${index + 1}`}
                className="h-full w-full rounded-lg"
                style={{ objectFit: 'fill' }}
              />
            </div>
          </div>
        ))}
      </div>
      <Markdown html>{textContent}</Markdown>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

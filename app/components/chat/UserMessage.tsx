/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
  timestamp?: Date;
}

function formatTime(date?: Date): string {
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function UserAvatar({ profile }: { profile: { avatar?: string; username?: string } | null }) {
  if (profile?.avatar) {
    return (
      <img
        src={profile.avatar}
        alt={profile?.username || 'User'}
        className="w-8 h-8 object-cover rounded-full"
        loading="eager"
        decoding="sync"
      />
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--bolt-chat-user-avatar-bg)' }}
    >
      <div className="i-ph:user text-sm text-bolt-elements-textSecondary" />
    </div>
  );
}

export function UserMessage({ content, parts, timestamp }: UserMessageProps) {
  const profile = useStore(profileStore);

  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  const textContent = Array.isArray(content)
    ? stripMetadata(content.find((item) => item.type === 'text')?.text || '')
    : stripMetadata(content);

  const displayName = profile?.username || 'You';
  const timeStr = formatTime(timestamp);

  return (
    <div className="flex gap-4 flex-row-reverse group">
      <div className="mt-1">
        <UserAvatar profile={profile} />
      </div>
      <div className="space-y-1 max-w-[85%]">
        <div className="flex items-baseline gap-2 justify-end">
          {timeStr && <span className="text-[10px] text-bolt-elements-textTertiary">{timeStr}</span>}
          <span className="text-xs font-bold text-bolt-elements-textPrimary">{displayName}</span>
        </div>
        <div
          className="p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed shadow-md text-white"
          style={{
            background: 'var(--bolt-chat-user-bubble-bg)',
          }}
        >
          {images.length > 0 && (
            <div className="flex gap-3.5 mb-3">
              {images.map((item, index) => (
                <div key={index} className="relative flex rounded-lg overflow-hidden">
                  <img
                    src={`data:${item.mimeType};base64,${item.data}`}
                    alt={`Image ${index + 1}`}
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="[&_*]:!text-white [&_a]:underline">
            <Markdown html>{textContent}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

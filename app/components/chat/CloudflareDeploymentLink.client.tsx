import { useStore } from '@nanostores/react';
import { cloudflareConnection, fetchCloudflareProjects } from '~/lib/stores/cloudflare';
import { chatId } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect } from 'react';

export function CloudflareDeploymentLink() {
  const connection = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);

  useEffect(() => {
    if (connection.token && connection.accountId) {
      fetchCloudflareProjects(connection.token, connection.accountId);
    }
  }, [connection.token, connection.accountId]);

  const project = connection.projects?.find((p) => p.name.includes(`bolt-diy-${currentChatId}`));

  if (!project) {
    return null;
  }

  const url = project.subdomain ? `https://${project.subdomain}` : `https://${project.name}.pages.dev`;

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-orange-500 z-50"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="i-ph:link w-4 h-4 hover:text-blue-400" />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-50"
            sideOffset={5}
          >
            {url}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

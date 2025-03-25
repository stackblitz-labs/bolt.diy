import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { GitUrlImport } from '~/components/git/GitUrlImport.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export async function loader(args: LoaderFunctionArgs) {
  return json({ url: args.params.url });
}

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly
        fallback={
          <BaseChat
            input=""
            messages={[]}
            showChat={true}
            chatStarted={false}
            isStreaming={false}
            onStreamingChange={function noOp() {}}
            enhancingPrompt={false}
            _promptEnhanced={false}
            handleInputChange={function noOp() {}}
            handleKeyDown={function noOp() {}}
            _handleResetChat={function noOp() {}}
          />
        }
      >
        {() => <GitUrlImport />}
      </ClientOnly>
    </div>
  );
}

import { ClientOnly } from 'remix-utils/client-only';
import { VideoSection, HeroSection, HowItWorksSection, FaqSection } from './components';
import { Menu } from '~/components/sidebar/Menu.client';
import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { authStatusStore } from '~/lib/stores/auth';

const LandingPage = () => {
  const isLoggedIn = useStore(authStatusStore.isLoggedIn);

  return (
    <TooltipProvider>
      <div className="w-full h-full overflow-y-auto bg-bolt-elements-background-depth-1 relative">
        {!isLoggedIn && (
          <div className="fixed top-2 left-3 z-[1000] cursor-pointer">
            <a
              href="/"
              className="block p-2 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 cursor-pointer"
            >
              <div className="i-ph:house text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200 hover:scale-105 cursor-pointer" />
            </a>
          </div>
        )}
        <main className="pt-6 sm:pt-20 pb-8">
          {isLoggedIn && <ClientOnly>{() => <Menu />}</ClientOnly>}
          <div className="max-w-6xl mx-auto px-6">
            <VideoSection />

            <HeroSection />

            <HowItWorksSection />

            <FaqSection />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default LandingPage;

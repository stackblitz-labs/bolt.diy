import { useStore } from '@nanostores/react';
import type { LinksFunction, LoaderFunction } from '~/lib/remix-types';
import { json } from '~/lib/remix-types';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, useLoaderData } from '@remix-run/react';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useState } from 'react';
import { logStore } from './lib/stores/logs';
import { initializeAuth, userStore, isLoadingStore } from './lib/stores/auth';
import { initializeUserStores } from './lib/stores/user';
import { ToastContainer, toast, cssTransition } from 'react-toastify';
import { Check, X } from 'lucide-react';
import { Analytics } from '@vercel/analytics/remix';
import GlobalFeedbackModal from './components/sidebar/Feedback/components/FeedbackModal';
import { GlobalAccountModal } from './components/auth/GlobalAccountModal';
import { GlobalAuthModal } from './components/auth/GlobalAuthModal';
import AppHistoryModal from './components/workbench/VesionHistory/AppHistoryModal';
import { GlobalStripeStatusModal } from './components/stripe/GlobalStripeStatusModal';
import { GlobalStatusModal } from './components/status-modal/GlobalStatusModal';
import { GlobalDeployChatModal } from './components/header/components/DeployChat/components/GlobalDeployChatModal';
import { GlobalAppSettingsModal } from './components/header/components/AppSettings/GlobalAppSettingsModal';
import GlobalFeatureModal from './components/feature-modal/GlobalFeatureModal';
import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';
import { getAnalyticsCode } from './embeds/anayltics';

import './styles/tailwind.css';

interface LoaderData {
  ENV: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    STRIPE_PUBLISHABLE_KEY: string;
    INTERCOM_APP_ID: string;
  };
}

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

export const loader: LoaderFunction = async () => {
  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
  const publicIntercomAppId = process.env.INTERCOM_APP_ID as string;
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY as string;

  return json<LoaderData>({
    ENV: {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: supabaseAnonKey,
      INTERCOM_APP_ID: publicIntercomAppId,
      STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
    },
  });
};

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

const logRocketInit = stripIndents`
  window.LogRocket && window.LogRocket.init('woocwd/nut', { console: { isEnabled: false } });
`;

const intercomInit = stripIndents`
  // We pre-filled your app ID in the widget URL: 'https://widget.intercom.io/widget/k7f741xx'
  // Only load Intercom on non-mobile devices
  (function(){if(window.innerWidth<800){return;}var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/k7f741xx';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
`;

export const Head = createHead(() => {
  // Use default key - will be moved to env var in production
  const analyticsCode = getAnalyticsCode('RA2xErHLQaGZ3YeTxzEYw3gmraAfWPIR');

  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
      <Meta />
      <Links />
      <script src="https://cdn.lgrckt-in.com/LogRocket.min.js" crossOrigin="anonymous"></script>
      <script dangerouslySetInnerHTML={{ __html: intercomInit }} />
      <script dangerouslySetInnerHTML={{ __html: logRocketInit }} />
      <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
      <script dangerouslySetInnerHTML={{ __html: analyticsCode }} />
      <script
        async
        src="https://replay-analytics.netlify.app/umami.js"
        data-website-id="97c7e1d9-1b55-46ef-8cd5-8fb5886adac9"
        data-host-url="https://replay-analytics.netlify.app"
      />
    </>
  );
});

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted ? <>{children}</> : null;
}

function ThemeProvider() {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
}

function AuthProvider({ data }: { data: LoaderData }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.ENV = data.ENV;

      // Initialize auth and user stores
      initializeAuth().catch((err: Error) => {
        logStore.logError('Failed to initialize auth', err);
        console.error('Failed to initialize auth:', err);
        toast.error('Could not log in to the server. Please reload the page, or close other open tabs and try again', {
          autoClose: false,
          position: 'top-center',
          theme: 'colored',
        });
      });
      initializeUserStores().catch((err: Error) => {
        logStore.logError('Failed to initialize user stores', err);
      });
    }
  }, [data]);

  return null;
}

export const ErrorBoundary = () => {
  const error = useRouteError();

  // Log error to console
  console.error('Application error:', error instanceof Error ? error : new Error(String(error)));

  return <div>Something went wrong</div>;
};

export default function App() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    window.ENV = data.ENV;
    setMounted(true);
  }, []);

  // Only access stores on the client side
  const theme = useStore(themeStore);
  const user = useStore(userStore);
  const isLoading = useStore(isLoadingStore);

  useEffect(() => {
    if (mounted) {
      logStore.logSystem('Application initialized', {
        theme,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        isAuthenticated: !!user,
      });
    }
  }, [theme, user, mounted]);

  return (
    <>
      <ClientOnly>
        <ThemeProvider />
        <AuthProvider data={data} />
        <main className="h-full">{isLoading ? <div></div> : <Outlet />}</main>
        <ToastContainer
          closeButton={({ closeToast }) => {
            return (
              <button className="Toastify__close-button" onClick={closeToast}>
                <X className="text-lg" />
              </button>
            );
          }}
          icon={({ type }) => {
            switch (type) {
              case 'success': {
                return <Check className="text-bolt-elements-icon-success text-2xl" />;
              }
              case 'error': {
                return <div className="text-bolt-elements-icon-error text-2xl">⚠️</div>;
              }
            }

            return undefined;
          }}
          position="bottom-right"
          theme={theme}
          pauseOnFocusLoss
          transition={toastAnimation}
        />
        <GlobalFeedbackModal />
        <GlobalAccountModal />
        <GlobalAuthModal />
        <AppHistoryModal />
        <GlobalStripeStatusModal />
        <GlobalStatusModal />
        <GlobalDeployChatModal />
        <GlobalAppSettingsModal />
        <GlobalFeatureModal />
      </ClientOnly>
      <ScrollRestoration />
      <Scripts />
      <Analytics />
    </>
  );
}

import { useStore } from '@nanostores/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, type LinksFunction } from 'react-router';
import { cssTransition, ToastContainer } from 'react-toastify';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import { ClientOnly } from 'remix-utils/client-only';

import 'virtual:uno.css';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
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
  {
    rel: 'preconnect',
    href: 'https://unpkg.com',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://unpkg.com',
  },
];

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

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <html lang="en" data-theme={theme} className="w-full h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
      </head>
      <body className="w-full h-full">
        {/*
          The app boots a WebContainer and reads IndexedDB/localStorage, so it is
          genuinely client-only. `ClientOnly` renders `fallback` on the server and
          on the first client render (keeping hydration in sync), then swaps in the
          real tree once mounted.
        */}
        <ClientOnly fallback={<div className="w-full h-full" />}>
          {() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}
        </ClientOnly>
        <ToastContainer
          closeButton={({ closeToast }) => {
            return (
              <button className="Toastify__close-button" onClick={closeToast}>
                <div className="i-ph:x text-lg" />
              </button>
            );
          }}
          icon={({ type }) => {
            switch (type) {
              case 'success': {
                return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
              }
              case 'error': {
                return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
              }
            }

            return undefined;
          }}
          position="bottom-right"
          pauseOnFocusLoss
          transition={toastAnimation}
          autoClose={3000}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { logStore } from './lib/stores/logs';
import { themeStore } from './lib/stores/theme';
import globalStyles from './styles/index.scss?url';
import { stripIndents } from './utils/stripIndent';
import { journeys, observeWebVitals } from './lib/performance/metrics';
import { prebootWebContainer } from './lib/performance/webcontainer-optimizer';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    // Mark app launch start
    journeys.appLaunch.start();
    journeys.appLaunch.reactHydrated();

    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Start Web Vitals observation
    observeWebVitals();

    // Pre-boot WebContainer in background
    prebootWebContainer();

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });

    // Mark app as interactive
    journeys.appLaunch.interactive({
      theme,
      performance: {
        navigation: performance.getEntriesByType('navigation')[0],
      },
    });
  }, []);

  /*
   * React Router applies the root route's `Layout` export itself, wrapping this
   * component. Rendering `<Layout>` here as well would nest a second
   * `<html>/<head>/<body>` inside the first, which React reports as invalid DOM
   * nesting and duplicate-element mounts. Remix v2 required the explicit wrap;
   * React Router 8 does not.
   */
  return <Outlet />;
}

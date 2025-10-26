import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

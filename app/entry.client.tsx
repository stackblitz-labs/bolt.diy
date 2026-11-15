import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import '~/utils/clearLocks';

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});

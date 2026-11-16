import { createContext } from 'react-router';

/** Per-request nonce shared by the server entry and the root route. */
export const cspNonceContext = createContext<string>('');

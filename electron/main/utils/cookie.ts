import { session } from 'electron';
import { DEFAULT_PORT } from './constants';
import { store } from './store';

/**
 * On app startup: read any existing cookies from store and set it as a cookie.
 */
export async function initCookies() {
  await loadStoredCookies();
}

// Function to store all cookies
export async function storeCookies(cookies: Electron.Cookie[]) {
  for (const cookie of cookies) {
    store.set(`cookie:${cookie.name}`, cookie);
  }
}

// Function to load stored cookies
async function loadStoredCookies() {
  // Get all keys that start with 'cookie:'
  const cookieKeys = store.store ? Object.keys(store.store).filter((key) => key.startsWith('cookie:')) : [];

  for (const key of cookieKeys) {
    const cookie = store.get(key);

    if (cookie) {
      try {
        // Add default URL if not present
        const cookieWithUrl = {
          ...cookie,
          url: cookie.url || `http://localhost:${DEFAULT_PORT}`,
        };
        await session.defaultSession.cookies.set(cookieWithUrl);
      } catch (error) {
        console.error(`Failed to set cookie ${key}:`, error);
      }
    }
  }
}

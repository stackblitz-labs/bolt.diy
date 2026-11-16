import Cookies from 'js-cookie';

type CookieAttributes = Cookies.CookieAttributes;

const isSecureContext = () => typeof window !== 'undefined' && window.location.protocol === 'https:';

/** Set browser-readable cookies with transport and cross-site protections. */
export function setSecureCookie(name: string, value: string, options: CookieAttributes = {}) {
  Cookies.set(name, value, {
    ...options,
    path: options.path ?? '/',
    secure: isSecureContext(),
    sameSite: 'strict',
  });
}

export function removeSecureCookie(name: string, options: CookieAttributes = {}) {
  Cookies.remove(name, {
    ...options,
    path: options.path ?? '/',
    secure: isSecureContext(),
    sameSite: 'strict',
  });
}

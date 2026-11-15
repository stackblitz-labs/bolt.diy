/*
 * The app embeds these docs in a cross-origin iframe, so pass only the
 * light/dark preference in the URL and let Material apply its own palette.
 */
(() => {
  const requestedTheme = new URLSearchParams(window.location.search).get('theme');

  const isAllowedTheme = (theme) => theme === 'light' || theme === 'dark';

  let theme;

  if (isAllowedTheme(requestedTheme)) {
    theme = requestedTheme;
    document.body.setAttribute('data-md-color-scheme', theme === 'dark' ? 'slate' : 'default');

    try {
      localStorage.setItem('bolt-theme', theme);
    } catch {}

    return;
  }

  try {
    theme = localStorage.getItem('bolt-theme');
  } catch {}

  if (isAllowedTheme(theme)) {
    document.body.setAttribute('data-md-color-scheme', theme === 'dark' ? 'slate' : 'default');
  }
})();

// The app embeds these docs in a cross-origin iframe, so pass only the
// light/dark preference in the URL and let Material apply its own palette.
(() => {
  const theme = new URLSearchParams(window.location.search).get('theme');

  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-md-color-scheme', theme === 'dark' ? 'slate' : 'default');
  }
})();

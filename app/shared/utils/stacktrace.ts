/**
 * Cleans webcontainer URLs from stack traces to show relative paths instead
 */
export function cleanStackTrace(stackTrace: string): string {
  // Function to clean a single URL
  const cleanUrl = (url: string): string => {
    const regex = /^https?:\/\/[^\/]+\.webcontainer-api\.io(\/.*)?$/;

    if (!regex.test(url)) {
      return url;
    }

    const pathRegex = /^https?:\/\/[^\/]+\.webcontainer-api\.io\/(.*?)$/;
    const match = url.match(pathRegex);

    return match?.[1] || '';
  };

  // Split the stack trace into lines and process each line
  return stackTrace
    .split('\n')
    .map((line) => {
      // Match any URL in the line that contains webcontainer-api.io
      return line.replace(/(https?:\/\/[^\/]+\.webcontainer-api\.io\/[^\s\)]+)/g, (match) => cleanUrl(match));
    })
    .join('\n');
}

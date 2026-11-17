/*
 * Chrome's DevTools frontend probes this URL on every document load to discover
 * a workspace configuration. The probe is optional, but without a matching
 * route React Router logs a "No route matches URL" error for every page load,
 * which buries the logs that matter during development.
 */
export const loader = () => new Response(null, { status: 404 });

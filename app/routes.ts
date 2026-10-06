import { flatRoutes } from '@react-router/fs-routes';

/*
 * React Router 8 requires an explicit route config. `flatRoutes()` reproduces the
 * exact file-based convention Remix v2 was using, including the nesting quirks
 * this app depends on:
 *   - `api.models.$provider.ts` nests under `api.models.ts`  -> /api/models/:provider
 *   - `api.supabase.query.ts` / `.variables.ts` nest under `api.supabase.ts`
 *   - `api.system.*.ts` have no `api.system.ts` parent, so they stay top level
 *   - `api.git-proxy.$.ts` is a splat                          -> /api/git-proxy/*
 */
export default flatRoutes();

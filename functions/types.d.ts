// Type declarations for any path that resolves to the server build
declare module '**/build/server' {
    import type { ServerBuild } from '@remix-run/cloudflare';
    const build: ServerBuild;
    export = build;
}
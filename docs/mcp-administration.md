# MCP administration

MCP configuration can start server processes or connect to remote MCP services. Both
`/api/mcp-update-config` and `/api/mcp-check` require the operator's bearer token.
An unset or shorter-than-32-character token disables these endpoints with HTTP 503.
Missing or incorrect credentials receive HTTP 401 before clients are created or reconnected.

Generate a private random token:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For the Cloudflare Vite development server, set `MCP_ADMIN_TOKEN` in the ignored
`.dev.vars` file and restart the server. Node adapters can instead read it from
the server process environment. For Cloudflare deployments, store it as a Worker secret with
`pnpm exec wrangler secret put MCP_ADMIN_TOKEN`. Do not prefix the variable with
`VITE_`, publish it in source control, or expose it in a client environment endpoint.

In Preferences, open MCP and enter the token under MCP administration, then select
Save Configuration. The browser keeps the token in memory only. After a page reload,
enter it again to connect saved servers or check their availability. Existing saved
configuration remains editable without a token, but servers do not reconnect automatically.
Other connector settings continue to load normally.

These endpoints also reject cross-origin browser requests and limit configuration JSON
to 64 KiB. Configurations are validated before existing clients are changed.
Server logs omit configuration contents, command arguments, and remote URL credentials.

The token grants permission to administer all external MCP servers in this app process.
It is not a separate user or workspace identity. Shared deployments still need application
access controls, and operators should grant the token only to people trusted to configure
server commands and outbound connections.

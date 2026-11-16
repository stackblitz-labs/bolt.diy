# Frequently Asked Questions

These answers cover setup and troubleshooting questions that recur in the [closed issue tracker](https://github.com/stackblitz-labs/bolt.diy/issues?q=is%3Aissue+state%3Aclosed). Check the current [README](README.md) and [open issues](https://github.com/stackblitz-labs/bolt.diy/issues) for changes and active reports.

## Providers and models

### How do I add or change an API key?

In bolt.diy, open **Settings → Providers**, enable the provider, then select it in the chat composer and choose **Edit API Key**. You can also configure supported provider variables in `.env.local` at the repository root. Restart the development server after changing environment variables.

Keys entered in the UI are stored in browser cookies and sent with requests. A key indicator means a value is saved; it does not verify that the provider accepts it. Keep environment files and browser access private. For an authentication error, confirm the selected provider, key, and model, then check the browser console and server or container logs. The missing-key reports often come down to credentials not reaching the selected provider (for example, [issue #446](https://github.com/stackblitz-labs/bolt.diy/issues/446)).

For Docker Compose, keep `.env` synchronized with `.env.local`: Compose uses `.env` for variable substitution and passes both files into the container. Run `./scripts/setup-env.sh` after editing `.env.local`, or copy it to `.env` manually. Never commit either file.

### Why is the model list empty, or why does chat keep loading without a reply?

Confirm that the intended provider is enabled and selected, that its API key or local endpoint is configured, and that the selected model is available to that provider. For hosted providers, check the provider account, key permissions, and service status. For local providers, make sure the model server is running and reachable from bolt.diy. Then inspect the browser console and server/container logs for the provider error. A closed report about a hosted model request that stayed loading is [issue #1491](https://github.com/stackblitz-labs/bolt.diy/issues/1491).

### Can I use Ollama or LM Studio?

Yes. Start the Ollama or LM Studio server, enable it under **Settings → Providers**, and set its base URL if needed. For a local development server, the usual endpoints are `http://127.0.0.1:11434` for Ollama and `http://127.0.0.1:1234` for LM Studio. Make sure the model is installed or loaded in that service.

When bolt.diy runs in Docker, `127.0.0.1` points to the container. Use a host-reachable address such as `http://host.docker.internal:11434` or `http://host.docker.internal:1234`; the Compose configuration adds this host mapping. The endpoint setup has come up in closed reports such as [issue #762](https://github.com/stackblitz-labs/bolt.diy/issues/762).

### Can I connect an OpenAI-compatible service that is not listed by name?

Try the **OpenAI Like** provider and configure its base URL and model list. If the service does not implement the compatible API expected by that provider, it needs a dedicated provider implementation in the repository. See the provider examples under `app/lib/modules/llm/providers/` and register new implementations in `app/lib/modules/llm/registry.ts`.

## Projects and hosting

### Where are chats and project data saved? Do they sync across devices?

Chat history and snapshots are saved in IndexedDB in the current browser profile. Other settings are stored in browser storage or cookies. This data does not automatically sync to another browser or device, and clearing the site's browser data can remove it. Export a project or push it to a repository before clearing browser data or moving to another device.

### Can I host bolt.diy for multiple users with accounts and shared projects?

The app does not include user accounts, server-side project storage, or multi-user project synchronization. Its chat and project state is local to each browser profile. A self-hosted server can provide the app, but it does not turn browser data into shared storage. This distinction was discussed in [issue #1730](https://github.com/stackblitz-labs/bolt.diy/issues/1730).

### Is bolt.diy still being developed?

The maintainers described the current direction in [issue #2097](https://github.com/stackblitz-labs/bolt.diy/issues/2097): no new features are planned; work is focused on maintenance, dependency and security updates, and keeping the existing stack working. Check the [releases](https://github.com/stackblitz-labs/bolt.diy/releases) for shipped updates.

## Getting help

### What should I include when reporting a problem?

Include the operating system, browser or run method (local development, Docker, or desktop app), bolt.diy version or commit, steps to reproduce, and the exact error. For provider problems, include the provider and model name, but **never include API keys or other secrets**. Check the browser console and terminal/container logs, and search the [closed issues](https://github.com/stackblitz-labs/bolt.diy/issues?q=is%3Aissue+state%3Aclosed) and [open issues](https://github.com/stackblitz-labs/bolt.diy/issues) before creating a new report.

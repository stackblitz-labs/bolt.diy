# Welcome to bolt.diy

bolt.diy is an open-source AI developer workspace for building web applications in the browser. Choose a model provider for each prompt, work with project files in the integrated editor and terminal, and preview the running app. The application supports 22+ cloud and local providers. OpenRouter, Anthropic, OpenAI, and Google are enabled by default; enable and configure other providers under **Settings → Providers**.

For the current feature summary and command reference, see the [repository README](https://github.com/stackblitz-labs/bolt.diy#bolt-diy). For setup troubleshooting, see the [FAQ](FAQ.md).

## Features

- Browser-based development with an editor, terminal, and live preview powered by WebContainers
- Model selection across supported cloud and local providers
- Image and file attachments for prompts
- Project workflows including GitHub import/push, ZIP export, snapshots, and visual diffs
- MCP tools that can be selected for a prompt
- Supabase integration for connected projects
- Deployment integrations for Netlify, Vercel, and GitHub Pages
- Electron desktop app and Docker-based development/deployment options
- Prompt library, voice prompting, and configurable workspace settings

## Setup

### Prerequisites

- Git, if you plan to clone the repository
- Node.js **22.12.0 or later**
- pnpm **9.15.9 or later**
- Docker, if you plan to use the container setup

The supported Node.js and pnpm versions are defined in [`package.json`](https://github.com/stackblitz-labs/bolt.diy/blob/main/package.json).

### Clone and install

```bash
git clone https://github.com/stackblitz-labs/bolt.diy.git
cd bolt.diy
pnpm install
```

### Configure providers

You can set provider credentials in the application or in a local environment file.

To use environment variables, copy `.env.example` to `.env.local`, replace the placeholders for the providers you use, and remove or comment out unused placeholders. For example:

```dotenv
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
OPEN_ROUTER_API_KEY=your_key_here
OLLAMA_API_BASE_URL=http://127.0.0.1:11434
LMSTUDIO_API_BASE_URL=http://127.0.0.1:1234
```

In the app, enable a provider under **Settings → Providers**. Select it in the chat composer, choose **Edit API Key**, enter the key, and save. Keys entered in the UI are stored in JavaScript-accessible browser cookies and sent to the application server with requests; protect browser access and use HTTPS for remote deployments. A key status indicator means a key is set, not that the provider has validated it.

For OpenRouter's free router, select **OpenRouter** as the provider and **Free Models Router** (`openrouter/free`) as the model. Model availability and rate limits are controlled by OpenRouter. For Ollama or LM Studio running on the host while bolt.diy runs in Docker, use a host-reachable endpoint such as `host.docker.internal`; `127.0.0.1` inside the container refers to the container itself.

Never commit `.env.local` or `.env` files. Docker Compose uses `.env` for variable substitution and passes both `.env` and `.env.local` to the container. After configuring `.env.local`, run `./scripts/setup-env.sh` or copy it to `.env`; repeat this after changing `.env.local`.

### Run the development server

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use a current browser with WebContainer support; some browser features may require a secure context.

### Run with Docker

Configure the environment files as described above, then run:

```bash
docker compose --profile development up
```

For production image builds, use `pnpm run dockerbuild:prod` and `docker compose --profile production up`. See the repository [Docker Compose configuration](https://github.com/stackblitz-labs/bolt.diy/blob/main/docker-compose.yaml) for the available services and ports.

## Working with projects

Describe the framework or stack you want in your first prompt. When a matching starter is available, bolt.diy can import it and then continue implementing your request. A starter is only a starting point: review the generated files and check that the app runs in the preview.

You can select configured MCP tools from the attachment menu beside the prompt composer. To use Supabase, connect the service and select a project in the chat interface before asking bolt.diy to work with it.

Project import, push, and deployment options depend on the service connection and project compatibility. Manage service connections under **Settings → Integrations → Connectors**. Use the in-app deployment flow for provider-specific instructions and status.

## Add a provider

Providers are implemented as classes in `app/lib/modules/llm/providers/` and exported from `app/lib/modules/llm/registry.ts`. Extending `BaseProvider` alone does not register a provider; include it in the registry. Follow the patterns in existing provider files and check the current `BaseProvider` and `ModelInfo` types before implementing a new integration, since the provider interface can change.

## Development commands

Common commands from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start the development server |
| `pnpm run build` | Build the app for production |
| `pnpm run preview` | Build and preview locally |
| `pnpm run typecheck` | Run TypeScript type checking |
| `pnpm run lint` | Run ESLint |
| `pnpm test` | Run the Vitest suite |
| `pnpm run test:e2e` | Run Playwright end-to-end tests |
| `pnpm run dockerbuild` | Build the development Docker image |
| `pnpm run dockerbuild:prod` | Build the production Docker image |
| `pnpm run deploy` | Build and deploy to Cloudflare Workers |

For contribution steps, see the [Contributing Guide](CONTRIBUTING.md). For the full set of scripts, consult [`package.json`](https://github.com/stackblitz-labs/bolt.diy/blob/main/package.json).

## Support

- [FAQ and troubleshooting](FAQ.md)
- [GitHub issues](https://github.com/stackblitz-labs/bolt.diy/issues)
- [bolt.diy community](https://thinktank.ottomator.ai/c/bolt-diy/17)
- [Repository README](https://github.com/stackblitz-labs/bolt.diy#bolt-diy)

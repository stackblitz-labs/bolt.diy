# Frequently Asked Questions

## Models and setup

??? question "Which models should I use?"
    Model availability and capability change over time. Browse the model list for your configured provider in the application. For coding, choose a model with strong code skills and enough context for your project; use a smaller model when speed or cost matters. Local providers such as Ollama and LM Studio are options when you want to run models on your own machine.

??? question "How do I configure an API key?"
    In the app, enable a provider under **Settings → Providers**, select it in the chat composer, choose **Edit API Key**, and save the key. You can also set supported provider variables in `.env.local` at the repository root. The key indicator only means that a key is stored; it does not validate the key with the provider.

    Keys entered in the UI are stored in JavaScript-accessible browser cookies and sent to the application server with requests. Protect access to the browser and use HTTPS when exposing the app remotely. Never commit `.env.local` or `.env` files.

??? question "How do I use Ollama or LM Studio with Docker?"
    Set `OLLAMA_API_BASE_URL` or `LMSTUDIO_API_BASE_URL` to an address reachable from the container. Inside Docker, `127.0.0.1` points to the container. On supported systems, use a host address such as `host.docker.internal`.

??? question "How do I use OpenRouter's free model router?"
    Choose **OpenRouter** in the provider selector and **Free Models Router** (`openrouter/free`) in the model selector. Availability and rate limits are controlled by OpenRouter.

## Projects and integrations

??? question "How do I start with a particular framework?"
    Mention the framework or stack in your first prompt. When a matching starter is available, bolt.diy can import it and continue with your requested changes. Starters can change over time; review the generated project and check the preview after the build.

??? question "How do I use MCP tools?"
    Configure an MCP server under **Settings → MCP Servers**. Then open the attachment menu beside the prompt composer and select the tools you want available for that prompt. Only select tools from servers you trust.

??? question "How do I connect Supabase?"
    Connect Supabase and select a project from the chat interface before asking bolt.diy to work with its database. Database setup and credentials are managed through that connection; the app's WebContainer does not include the Supabase CLI.

??? question "How do I import or publish a project?"
    Connect the relevant service under **Settings → Integrations → Connectors**. Available project and deployment actions depend on the service and project. Follow the in-app flow for connection, permissions, and deployment status. You can also export a project as a ZIP.

## Troubleshooting

??? error "A request fails with an API key error"
    Confirm the provider is enabled and selected, and that the key is present in the provider's **Edit API Key** dialog or in the server environment. A stored-key indicator does not confirm provider-side validity. Check the provider's account status and the app/server logs for the response details.

??? error "The preview is blank or does not load"
    Check the terminal for install or development-server errors, confirm that the expected development server is running, and inspect the browser console. Some WebContainer features require a supported browser and secure context. Refreshing the preview can help after the server starts, but fix any reported build errors first.

??? error "A local provider cannot be reached from Docker"
    The address `127.0.0.1` inside the container refers to the container. Set the provider base URL to an address reachable from Docker, such as `host.docker.internal` where supported, and confirm the provider accepts connections from that host.

??? error "Docker Compose reports a missing variable or env file"
    Compose needs both `.env` and `.env.local`. Copy `.env.example` to `.env.local`, configure the variables you need, and run `./scripts/setup-env.sh` to prepare `.env`. Repeat this after changing `.env.local`; shell environment variables can override Compose substitution values.

??? error "An MCP server does not connect"
    Check the server URL, authentication settings, and server logs. Confirm the server is running and reachable from the application environment, then retry the connection.

??? error "The app does not start locally"
    Check that Node.js and pnpm meet the versions in [`package.json`](https://github.com/stackblitz-labs/bolt.diy/blob/main/package.json), reinstall dependencies with `pnpm install`, and review the terminal output. For current setup commands, see the [documentation home](index.md) and [repository README](https://github.com/stackblitz-labs/bolt.diy#quick-start).

## Contributing and support

??? question "How do I contribute or report an issue?"
    Read the [Contributing Guide](CONTRIBUTING.md). Report bugs or request features through the [GitHub issue tracker](https://github.com/stackblitz-labs/bolt.diy/issues).

??? question "Where can I find the roadmap?"
    See the project's [public roadmap](https://roadmap.sh/r/ottodev-roadmap-2ovzo). Model and integration support may change between releases, so use the current app and repository documentation for up-to-date details.

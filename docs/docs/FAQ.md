# Frequently Asked Questions (FAQ)

## Models and Setup

??? question "What are the best models for bolt.diy?"
For the best experience with bolt.diy, we recommend using the following models from our 19 supported providers:

    **Top Recommended Models:**
    - **Claude 3.5 Sonnet** (Anthropic): Best overall coder, excellent for complex applications
    - **GPT-4o** (OpenAI): Strong alternative with great performance across all use cases
    - **Claude 4 Opus** (Anthropic): Latest flagship model with enhanced capabilities
    - **Gemini 2.0 Flash** (Google): Exceptional speed for rapid development
    - **DeepSeekCoder V3** (DeepSeek): Best open-source model for coding tasks

    **Self-Hosting Options:**
    - **DeepSeekCoder V2 236b**: Powerful self-hosted option
    - **Qwen 2.5 Coder 32b**: Best for moderate hardware requirements
    - **Ollama models**: Local inference with various model sizes

    **Latest Specialized Models:**
    - **Moonshot AI (Kimi)**: Kimi K2 models with advanced reasoning capabilities
    - **xAI Grok 4**: Latest Grok model with 256K context window
    - **Anthropic Claude 4 Opus**: Latest flagship model from Anthropic

    !!! tip "Model Selection Tips"
        - Use larger models (7B+ parameters) for complex applications
        - Claude models excel at structured code generation
        - GPT-4o provides excellent general-purpose coding assistance
        - Gemini models offer the fastest response times

??? question "How do I configure API keys for different providers?"
You can configure API keys in two ways:

    **Option 1: Environment Variables (Recommended for production)**
    Create a `.env.local` file in your project root:
    ```bash
    ANTHROPIC_API_KEY=your_anthropic_key_here
    OPENAI_API_KEY=your_openai_key_here
    GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
    MOONSHOT_API_KEY=your_moonshot_key_here
    XAI_API_KEY=your_xai_key_here
    ```

    **Option 2: In-App Configuration**
    - Click the settings icon (⚙️) in the sidebar
    - Navigate to the "Providers" tab
    - Switch between "Cloud Providers" and "Local Providers" tabs
    - Click on a provider card to expand its configuration
    - Click on the "API Key" field to enter edit mode
    - Paste your API key and press Enter to save
    - Look for the green checkmark to confirm proper configuration

    !!! note "Security Note"
        Never commit API keys to version control. The `.env.local` file is already in `.gitignore`.

??? question "How do I add a new LLM provider?"
bolt.diy uses a modular provider architecture. To add a new provider:

    1. **Create a Provider Class** in `app/lib/modules/llm/providers/your-provider.ts`
    2. **Implement the BaseProvider interface** with your provider's specific logic
    3. **Register the provider** in `app/lib/modules/llm/registry.ts`
    4. **The system automatically detects** and registers your new provider

    See the [Adding New LLMs](../#adding-new-llms) section for complete implementation details.

??? question "How do I set up Moonshot AI (Kimi) provider?"
Moonshot AI provides access to advanced Kimi models with excellent reasoning capabilities:

    **Setup Steps:**
    1. Visit [Moonshot AI Platform](https://platform.moonshot.ai/console/api-keys)
    2. Create an account and generate an API key
    3. Add `MOONSHOT_API_KEY=your_key_here` to your `.env.local` file
    4. Or configure it directly in Settings → Providers → Cloud Providers → Moonshot

    **Available Models:**
    - **Kimi K2 Preview**: Latest Kimi model with 128K context
    - **Kimi K2 Turbo**: Fast inference optimized version
    - **Kimi Thinking**: Specialized for complex reasoning tasks
    - **Moonshot v1 series**: Legacy models with vision capabilities

    !!! tip "Moonshot AI Features"
        - Excellent for Chinese language tasks
        - Strong reasoning capabilities
        - Vision-enabled models available
        - Competitive pricing

??? question "What are the latest xAI Grok models?"
xAI has released several new Grok models with enhanced capabilities:

    **Latest Models:**
    - **Grok 4**: Most advanced model with 256K context window
    - **Grok 4 (07-09)**: Specialized variant for specific tasks
    - **Grok 3 Beta**: Previous generation with 131K context
    - **Grok 3 Mini variants**: Optimized for speed and efficiency

    **Setup:**
    1. Get your API key from [xAI Platform](https://docs.x.ai/docs/quickstart#creating-an-api-key)
    2. Add `XAI_API_KEY=your_key_here` to your `.env.local` file
    3. Models will be available in the provider selection

## Best Practices

??? question "How do I access help and documentation?"
bolt.diy provides multiple ways to access help and documentation:

    **Help Icon in Sidebar:**
    - Look for the question mark (?) icon in the sidebar
    - Click it to open the full documentation in a new tab
    - Provides instant access to guides, troubleshooting, and FAQs

    **Documentation Resources:**
    - **Main Documentation**: Complete setup and feature guides
    - **FAQ Section**: Answers to common questions
    - **Troubleshooting**: Solutions for common issues
    - **Best Practices**: Tips for optimal usage

    **Community Support:**
    - **GitHub Issues**: Report bugs and request features
    - **Community Forum**: [thinktank.ottomator.ai](https://thinktank.ottomator.ai)

??? question "How do I get the best results with bolt.diy?"
Follow these proven strategies for optimal results:

    **Project Setup:**
    - **Be specific about your stack**: Mention frameworks/libraries (Astro, Tailwind, ShadCN, Next.js) in your initial prompt
    - **Choose appropriate templates**: Use our 15+ project templates for quick starts
    - **Configure providers properly**: Set up your preferred LLM providers before starting

    **Development Workflow:**
    - **Use the enhance prompt icon**: Click the enhance icon to let AI refine your prompts before submitting
    - **Scaffold basics first**: Build foundational structure before adding advanced features
    - **Batch simple instructions**: Combine tasks like *"Change colors, add mobile responsiveness, restart dev server"*

    **Advanced Features:**
    - **Leverage MCP tools**: Use Model Context Protocol for enhanced AI capabilities
    - **Connect databases**: Integrate Supabase for backend functionality
    - **Use Git integration**: Version control your projects with GitHub
    - **Deploy easily**: Use built-in Vercel, Netlify, or GitHub Pages deployment

??? question "How do I use MCP (Model Context Protocol) tools?"
MCP extends bolt.diy's AI capabilities with external tools:

    **Setting up MCP:**
    1. Go to Settings → MCP tab
    2. Add MCP server configurations
    3. Configure server endpoints and authentication
    4. Enable/disable servers as needed

    **Available MCP Capabilities:**
    - Database connections and queries
    - File system operations
    - API integrations
    - Custom business logic tools

    The MCP integration allows the AI to interact with external services and data sources during conversations.

??? question "How do I deploy my bolt.diy projects?"
bolt.diy supports one-click deployment to multiple platforms:

    **Supported Platforms:**
    - **Vercel**: Go to Settings → Connections → Vercel, then deploy with one click
    - **Netlify**: Connect your Netlify account and deploy instantly
    - **GitHub Pages**: Push to GitHub and enable Pages in repository settings

    **Deployment Features:**
    - Automatic build configuration for popular frameworks
    - Environment variable management
    - Custom domain support
    - Preview deployments for testing

??? question "How do I use Git integration features?"
bolt.diy provides comprehensive Git and GitHub integration:

    **Basic Git Operations:**
    - Import existing repositories by URL
    - Create new repositories on GitHub
    - Automatic commits for major changes
    - Push/pull changes seamlessly

    **Advanced Features:**
    - Connect GitHub account in Settings → Connections
    - Import from your connected repositories
    - Version control with diff visualization
    - Collaborative development support

## Project Information

??? question "How do I contribute to bolt.diy?"
Check out our [Contribution Guide](CONTRIBUTING.md) for more details on how to get involved!

??? question "What are the future plans for bolt.diy?"
Visit our [Roadmap](https://roadmap.sh/r/ottodev-roadmap-2ovzo) for the latest updates.  
 New features and improvements are on the way!

??? question "Why are there so many open issues/pull requests?"
bolt.diy began as a small showcase project on @ColeMedin's YouTube channel to explore editing open-source projects with local LLMs. However, it quickly grew into a massive community effort!

    We're forming a team of maintainers to manage demand and streamline issue resolution. The maintainers are rockstars, and we're also exploring partnerships to help the project thrive.

## New Features & Technologies

??? question "What's new in bolt.diy?"
Recent major additions to bolt.diy include:

    **Advanced AI Capabilities:**
    - **19 LLM Providers**: Support for Anthropic, OpenAI, Google, DeepSeek, Cohere, and more
    - **MCP Integration**: Model Context Protocol for enhanced AI tool calling
    - **Dynamic Model Loading**: Automatic model discovery from provider APIs

    **Development Tools:**
    - **WebContainer**: Secure sandboxed development environment
    - **Live Preview**: Real-time application previews without leaving the editor
    - **Project Templates**: 15+ starter templates for popular frameworks

    **Version Control & Collaboration:**
    - **Git Integration**: Import/export projects with GitHub
    - **Automatic Commits**: Smart version control for project changes
    - **Diff Visualization**: See code changes clearly

    **Backend & Database:**
    - **Supabase Integration**: Built-in database and authentication
    - **API Integration**: Connect to external services and databases

    **Deployment & Production:**
    - **One-Click Deployment**: Vercel, Netlify, and GitHub Pages support
    - **Environment Management**: Production-ready configuration
    - **Build Optimization**: Automatic configuration for popular frameworks

??? question "How do I use the new project templates?"
bolt.diy offers templates for popular frameworks and technologies:

    **Getting Started:**
    1. Start a new project in bolt.diy
    2. Browse available templates in the starter selection
    3. Choose your preferred technology stack
    4. The AI will scaffold your project with best practices

    **Available Templates:**
    - **Frontend**: React, Vue, Angular, Svelte, SolidJS
    - **Full-Stack**: Next.js, Astro, Qwik, Remix, Nuxt
    - **Mobile**: Expo, React Native
    - **Content**: Slidev presentations, Astro blogs
    - **Vanilla**: Vite with TypeScript/JavaScript

    Templates include pre-configured tooling, linting, and build processes.

??? question "How does WebContainer work?"
WebContainer provides a secure development environment:

    **Features:**
    - **Isolated Environment**: Secure sandbox for running code
    - **Full Node.js Support**: Run npm, build tools, and dev servers
    - **Live File System**: Direct manipulation of project files
    - **Terminal Integration**: Execute commands with real-time output

    **Supported Technologies:**
    - All major JavaScript frameworks (React, Vue, Angular, etc.)
    - Build tools (Vite, Webpack, Parcel)
    - Package managers (npm, pnpm, yarn)

??? question "How do I connect external databases?"
Use Supabase for backend database functionality:

    **Setup Process:**
    1. Create a Supabase project at supabase.com
    2. Get your project URL and API keys
    3. Configure the connection in your bolt.diy project
    4. Use Supabase tools to interact with your database

    **Available Features:**
    - Real-time subscriptions
    - Built-in authentication
    - Row Level Security (RLS)
    - Automatic API generation
    - Database migrations

## Model Comparisons

??? question "How do local LLMs compare to larger models like Claude 3.5 Sonnet for bolt.diy?"
While local LLMs are improving rapidly, larger models still offer the best results for complex applications. Here's the current landscape:

    **Recommended for Production:**
    - **Claude 4 Opus**: Latest flagship model with enhanced reasoning (200K context)
    - **Claude 3.5 Sonnet**: Proven excellent performance across all tasks
    - **GPT-4o**: Strong general-purpose coding with great reliability
    - **xAI Grok 4**: Latest Grok with 256K context window

    **Fast & Efficient:**
    - **Gemini 2.0 Flash**: Exceptional speed for rapid development
    - **Claude 3 Haiku**: Cost-effective for simpler tasks
    - **xAI Grok 3 Mini Fast**: Optimized for speed and efficiency

    **Advanced Reasoning:**
    - **Moonshot AI Kimi K2**: Advanced reasoning with 128K context
    - **Moonshot AI Kimi Thinking**: Specialized for complex reasoning tasks

    **Open Source & Self-Hosting:**
    - **DeepSeekCoder V3**: Best open-source model available
    - **DeepSeekCoder V2 236b**: Powerful self-hosted option
    - **Qwen 2.5 Coder 32b**: Good balance of performance and resource usage

    **Local Models (Ollama):**
    - Best for privacy and offline development
    - Use 7B+ parameter models for reasonable performance
    - Still experimental for complex, large-scale applications

    !!! tip "Model Selection Guide"
        - Use Claude/GPT-4o for complex applications
        - Use Gemini for fast prototyping
        - Use local models for privacy/offline development
        - Always test with your specific use case

## Troubleshooting

??? error "There was an error processing this request"
This generic error message means something went wrong. Check these locations:

    - **Terminal output**: If you started with Docker or `pnpm`
    - **Browser developer console**: Press `F12` → Console tab
    - **Server logs**: Check for any backend errors
    - **Network tab**: Verify API calls are working

??? error "x-api-key header missing"
This authentication error can be resolved by:

    - **Restarting the container**: `docker compose restart` (if using Docker)
    - **Switching run methods**: Try `pnpm` if using Docker, or vice versa
    - **Checking API keys**: Verify your API keys are properly configured
    - **Clearing browser cache**: Sometimes cached authentication causes issues

??? error "Blank preview when running the app"
Blank previews usually indicate code generation issues:

    - **Check developer console** for JavaScript errors
    - **Verify WebContainer is running** properly
    - **Try refreshing** the preview pane
    - **Check for hallucinated code** in the generated files
    - **Restart the development server** if issues persist

??? error "MCP server connection failed"
If you're having trouble with MCP integrations:

    - **Verify server configuration** in Settings → MCP
    - **Check server endpoints** and authentication credentials
    - **Test server connectivity** outside of bolt.diy
    - **Review MCP server logs** for specific error messages
    - **Ensure server supports** the MCP protocol version

??? error "Git integration not working"
Common Git-related issues and solutions:

    - **GitHub connection failed**: Verify your GitHub token has correct permissions
    - **Repository not found**: Check repository URL and access permissions
    - **Push/pull failed**: Ensure you have write access to the repository
    - **Merge conflicts**: Resolve conflicts manually or use the diff viewer
    - **Large files blocked**: Check GitHub's file size limits

??? error "Deployment failed"
Deployment issues can be resolved by:

    - **Checking build logs** for specific error messages
    - **Verifying environment variables** are set correctly
    - **Testing locally** before deploying
    - **Checking platform-specific requirements** (Node version, build commands)
    - **Reviewing deployment configuration** in platform settings

??? error "Everything works, but the results are bad"
For suboptimal AI responses, try these solutions:

    - **Switch to a more capable model**: Use Claude 3.5 Sonnet, GPT-4o, or Claude 4 Opus
    - **Be more specific** in your prompts about requirements and technologies
    - **Use the enhance prompt feature** to refine your requests
    - **Break complex tasks** into smaller, focused prompts
    - **Provide context** about your project structure and goals

??? error "WebContainer preview not loading"
If the live preview isn't working:

    - **Check WebContainer status** in the terminal
    - **Verify Node.js compatibility** with your project
    - **Restart the development environment**
    - **Clear browser cache** and reload
    - **Check for conflicting ports** (default is 5173)

??? error "Received structured exception #0xc0000005: access violation"
**Windows-specific issue**: Update the [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)

??? error "Miniflare or Wrangler errors in Windows"
**Windows development environment**: Install Visual Studio C++ (version 14.40.33816 or later). More details in [GitHub Issues](https://github.com/stackblitz-labs/bolt.diy/issues/19)

??? error "Provider not showing up after adding it"
If your custom LLM provider isn't appearing:

    - **Restart the development server** to reload providers
    - **Check the provider registry** in `app/lib/modules/llm/registry.ts`
    - **Verify the provider class** extends `BaseProvider` correctly
    - **Check browser console** for provider loading errors
    - **Ensure proper TypeScript compilation** without errors

---

## Get Help & Support

!!! tip "Community Support"
[Join the bolt.diy Community](https://thinktank.ottomator.ai/c/bolt-diy/17){target=\_blank} for discussions and help

!!! bug "Report Issues"
[Open an Issue](https://github.com/stackblitz-labs/bolt.diy/issues/19){target=\_blank} in our GitHub Repository

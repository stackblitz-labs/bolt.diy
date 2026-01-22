# Welcome to bolt diy

bolt.diy allows you to choose the LLM that you use for each prompt! Currently, you can use models from 19 providers including OpenAI, Anthropic, Ollama, OpenRouter, Google/Gemini, LMStudio, Mistral, xAI, HuggingFace, DeepSeek, Groq, Cohere, Together AI, Perplexity AI, Hyperbolic, Moonshot AI (Kimi), Amazon Bedrock, GitHub Models, and more - with easy extensibility to add any other model supported by the Vercel AI SDK! See the instructions below for running this locally and extending it to include more models.

## Table of Contents

- [Join the community!](#join-the-community)
- [Features](#features)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Entering API Keys](#entering-api-keys)
    - [1. Set API Keys in the `.env.local` File](#1-set-api-keys-in-the-envlocal-file)
    - [2. Configure API Keys Directly in the Application](#2-configure-api-keys-directly-in-the-application)
- [Run the Application](#run-the-application)
  - [Option 1: Without Docker](#option-1-without-docker)
  - [Option 2: With Docker](#option-2-with-docker)
- [Update Your Local Version to the Latest](#update-your-local-version-to-the-latest)
- [Adding New LLMs](#adding-new-llms)
- [MCP (Model Context Protocol) Integration](#mcp-model-context-protocol-integration)
- [Git Integration and Version Control](#git-integration-and-version-control)
- [Deployment Options](#deployment-options)
- [Supabase Integration](#supabase-integration)
- [WebContainer and Live Preview](#webcontainer-and-live-preview)
- [Project Templates](#project-templates)
- [Available Scripts](#available-scripts)
- [Development](#development)
- [Tips and Tricks](#tips-and-tricks)

---

## Join the community!

[Join the community!](https://thinktank.ottomator.ai)

Also [this pinned post in our community](https://thinktank.ottomator.ai/t/videos-tutorial-helpful-content/3243) has a bunch of incredible resources for running and deploying bolt.diy yourself!

---

## Features

- **AI-powered full-stack web development** directly in your browser with live preview
- **Support for 19 LLM providers** with an extensible architecture to integrate additional models
- **Attach images and files to prompts** for better contextual understanding
- **Integrated terminal** with WebContainer sandbox for running commands and testing
- **Version control with Git** - import/export projects, connect to GitHub repositories
- **MCP (Model Context Protocol)** integration for enhanced AI capabilities and tool calling
- **Database integration** with Supabase for backend development
- **One-click deployments** to Vercel, Netlify, and GitHub Pages
- **Project templates** for popular frameworks (React, Vue, Angular, Next.js, Astro, etc.)
- **Real-time collaboration** and project sharing
- **Code diff visualization** and version history
- **Download projects as ZIP** or push directly to GitHub
- **Docker support** for containerized development environments
- **Electron app** for native desktop experience
- **Theme customization** and accessibility features
- **Help icon** in sidebar linking to comprehensive documentation

---

## Setup

If you're new to installing software from GitHub, don't worry! If you encounter any issues, feel free to submit an "issue" using the provided links or improve this documentation by forking the repository, editing the instructions, and submitting a pull request. The following instruction will help you get the stable branch up and running on your local machine in no time.

### Prerequisites

1. **Install Git**: [Download Git](https://git-scm.com/downloads)
2. **Install Node.js**: [Download Node.js](https://nodejs.org/en/download/)

   - After installation, the Node.js path is usually added to your system automatically. To verify:
     - **Windows**: Search for "Edit the system environment variables," click "Environment Variables," and check if `Node.js` is in the `Path` variable.
     - **Mac/Linux**: Open a terminal and run:
       ```bash
       echo $PATH
       ```
       Look for `/usr/local/bin` in the output.

### Clone the Repository

Alternatively, you can download the latest version of the project directly from the [Releases Page](https://github.com/stackblitz-labs/bolt.diy/releases/latest). Simply download the .zip file, extract it, and proceed with the setup instructions below. If you are comfertiable using git then run the command below.

Clone the repository using Git:

```bash
git clone https://github.com/stackblitz-labs/bolt.diy
cd bolt.diy
```

---

### Entering API Keys

There are two ways to configure your API keys in bolt.diy:

#### 1. Set API Keys in the `.env.local` File

When setting up the application, you will need to add your API keys for the LLMs you wish to use. You can do this by renaming the `.env.example` file to `.env.local` and adding your API keys there.

- On **Mac**, you can find the file at `[your name]/bolt.diy/.env.example`.
- On **Windows/Linux**, the path will be similar.

If you can't see the file, it's likely because hidden files are not being shown. On **Mac**, open a Terminal window and enter the following command to show hidden files:

```bash
defaults write com.apple.finder AppleShowAllFiles YES
```

Make sure to add your API keys for each provider you want to use, for example:

```
GROQ_API_KEY=XXX
OPENAI_API_KEY=XXX
ANTHROPIC_API_KEY=XXX
```

Once you've set your keys, you can proceed with running the app. You will set these keys up during the initial setup, and you can revisit and update them later after the app is running.

**Important for Docker users**: Docker Compose needs a `.env` file for variable substitution. After creating `.env.local`:
- Run `./scripts/setup-env.sh` to automatically sync the files, or  
- Manually copy: `cp .env.local .env`

**Note**: Never commit your `.env.local` or `.env` files to version control. They're already included in the `.gitignore`.

#### 2. Configure API Keys Directly in the Application

Alternatively, you can configure your API keys directly in the application using the modern settings interface:

1. **Open Settings**: Click the settings icon (⚙️) in the sidebar to access the settings panel
2. **Navigate to Providers**: Select the "Providers" tab from the settings menu
3. **Choose Provider Type**: Switch between "Cloud Providers" and "Local Providers" tabs
4. **Select Provider**: Browse the grid of available providers and click on the provider card you want to configure
5. **Configure API Key**: Click on the "API Key" field to enter edit mode, then paste your API key and press Enter
6. **Verify Configuration**: Look for the green checkmark indicator showing the provider is properly configured

The interface provides:
- **Real-time validation** with visual status indicators
- **Bulk operations** to enable/disable multiple providers at once
- **Secure storage** of API keys in browser cookies
- **Environment variable auto-detection** for server-side configurations

Once you've configured your keys, the application will be ready to use the selected LLMs.

---

## Run the Application

### Option 1: Without Docker

1. **Install Dependencies**:

   ```bash
   pnpm install
   ```

   If `pnpm` is not installed, install it using:

   ```bash
   sudo npm install -g pnpm
   ```

2. **Start the Application**:
   ```bash
   pnpm run dev
   ```
   This will start the Remix Vite development server. You will need Google Chrome Canary to run this locally if you use Chrome! It's an easy install and a good browser for web development anyway.

### Option 2: With Docker

#### Prerequisites

- Ensure Git, Node.js, and Docker are installed: [Download Docker](https://www.docker.com/)

#### Steps

1. **Build the Docker Image**:

   Use the provided NPM scripts:

   ```bash
   npm run dockerbuild
   ```

   Alternatively, use Docker commands directly:

   ```bash
   docker build . --target bolt-ai-development
   ```

2. **Run the Container**:  
   Use Docker Compose profiles to manage environments:

   ```bash
   docker compose --profile development up
   ```

   - With the development profile, changes to your code will automatically reflect in the running container (hot reloading).

---

### Update Your Local Version to the Latest

To keep your local version of bolt.diy up to date with the latest changes, follow these steps for your operating system:

#### 1. **Navigate to your project folder**

Navigate to the directory where you cloned the repository and open a terminal:

#### 2. **Fetch the Latest Changes**

Use Git to pull the latest changes from the main repository:

```bash
git pull origin main
```

#### 3. **Update Dependencies**

After pulling the latest changes, update the project dependencies by running the following command:

```bash
pnpm install
```

#### 4. **Rebuild and Start the Application**

- **If using Docker**, ensure you rebuild the Docker image to avoid using a cached version:

  ```bash
  docker compose --profile development up --build
  ```

- **If not using Docker**, you can start the application as usual with:
  ```bash
  pnpm run dev
  ```

This ensures that you're running the latest version of bolt.diy and can take advantage of all the newest features and bug fixes.

---

## Adding New LLMs

bolt.diy supports a modular architecture for adding new LLM providers and models. The system is designed to be easily extensible while maintaining consistency across all providers.

### Understanding the Provider Architecture

Each LLM provider is implemented as a separate class that extends the `BaseProvider` class. The provider system includes:

- **Static Models**: Pre-defined models that are always available
- **Dynamic Models**: Models that can be loaded from the provider's API at runtime
- **Configuration**: API key management and provider-specific settings

### Adding a New Provider

To add a new LLM provider, you need to create multiple files:

#### 1. Create the Provider Class

Create a new file in `app/lib/modules/llm/providers/your-provider.ts`:

```typescript
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createYourProvider } from '@ai-sdk/your-provider';

export default class YourProvider extends BaseProvider {
  name = 'YourProvider';
  getApiKeyLink = 'https://your-provider.com/api-keys';

  config = {
    apiTokenKey: 'YOUR_PROVIDER_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'your-model-name',
      label: 'Your Model Label',
      provider: 'YourProvider',
      maxTokenAllowed: 100000,
      maxCompletionTokens: 4000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    // Implement dynamic model loading if supported
    return [];
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Record<string, string>;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { apiKeys, model } = options;
    const apiKey = apiKeys?.[this.config.apiTokenKey] || '';

    return createYourProvider({
      apiKey,
      // other configuration options
    })(model);
  }
}
```

#### 2. Register the Provider

Add your provider to `app/lib/modules/llm/registry.ts`:

```typescript
import YourProvider from './providers/your-provider';

// ... existing imports ...

export {
  // ... existing exports ...
  YourProvider,
};
```

#### 3. Update the Manager (if needed)

The provider will be automatically registered by the `LLMManager` through the registry. The manager scans for all classes that extend `BaseProvider` and registers them automatically.

### Adding Models to Existing Providers

To add new models to an existing provider:

1. **Edit the provider file** (e.g., `app/lib/modules/llm/providers/openai.ts`)
2. **Add to the `staticModels` array**:

```typescript
staticModels: ModelInfo[] = [
  // ... existing models ...
  {
    name: 'gpt-4o-mini-new',
    label: 'GPT-4o Mini (New)',
    provider: 'OpenAI',
    maxTokenAllowed: 128000,
    maxCompletionTokens: 16000,
  },
];
```

### Provider-Specific Configuration

Each provider can have its own configuration options:

- **API Key Environment Variables**: Define in the `config` object
- **Base URL Support**: Add `baseUrlKey` for custom endpoints
- **Provider Settings**: Custom settings in the UI
- **Dynamic Model Loading**: Implement `getDynamicModels()` for API-based model discovery

### Testing Your New Provider

1. **Restart the development server** after making changes
2. **Check the provider appears** in the Settings → Providers section
3. **Configure API keys** in the provider settings
4. **Test the models** in a chat session

### Best Practices

- **Follow the naming conventions** used by existing providers
- **Include proper error handling** for API failures
- **Add comprehensive documentation** for your provider
- **Test with both static and dynamic models**
- **Ensure proper API key validation**

The modular architecture makes it easy to add new providers while maintaining consistency and reliability across the entire system.

---

## MCP (Model Context Protocol) Integration

bolt.diy supports MCP (Model Context Protocol) servers to extend AI capabilities with external tools and services. MCP allows you to connect various tools and services that the AI can use during conversations.

### Setting up MCP Servers

1. Navigate to Settings → MCP tab
2. Add MCP server configurations
3. Configure server endpoints and authentication
4. Enable/disable servers as needed

MCP servers can provide:
- Database connections and queries
- File system operations
- API integrations
- Custom business logic tools
- And much more...

The MCP integration enhances the AI's ability to perform complex tasks by giving it access to external tools and data sources.

---

## Git Integration and Version Control

bolt.diy provides comprehensive Git integration for version control, collaboration, and project management.

### GitHub Integration

1. **Connect your GitHub account** in Settings → Connections → GitHub
2. **Import existing repositories** by URL or from your connected account
3. **Push projects directly to GitHub** with automatic repository creation
4. **Sync changes** between local development and remote repositories

### Version Control Features

- **Automatic commits** for major changes
- **Diff visualization** to see code changes
- **Branch management** and merge conflict resolution
- **Revert to previous versions** for debugging
- **Collaborative development** with team members

### Export Options

- **Download as ZIP** for easy sharing
- **Push to GitHub** for version control and collaboration
- **Import from GitHub** to continue working on existing projects

---

## Deployment Options

bolt.diy provides one-click deployment to popular hosting platforms, making it easy to share your projects with the world.

### Supported Platforms

#### Vercel Deployment
1. Connect your Vercel account in Settings → Connections → Vercel
2. Click the deploy button in your project
3. bolt.diy automatically builds and deploys your project
4. Get a live URL instantly with Vercel's global CDN

#### Netlify Deployment
1. Connect your Netlify account in Settings → Connections → Netlify
2. Deploy with a single click
3. Automatic build configuration and optimization
4. Preview deployments for every change

#### GitHub Pages
1. Connect your GitHub account
2. Push your project to a GitHub repository
3. Enable GitHub Pages in repository settings
4. Automatic deployment from your repository

### Deployment Features

- **Automatic build configuration** for popular frameworks
- **Environment variable management** for production
- **Custom domain support** through platform settings
- **Deployment previews** for testing changes
- **Rollback capabilities** for quick issue resolution

---

## Supabase Integration

bolt.diy integrates with Supabase to provide backend database functionality, authentication, and real-time features for your applications.

### Setting up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and API keys from the Supabase dashboard
3. Configure the connection in your bolt.diy project
4. Use the Supabase tools to interact with your database

### Database Features

- **Real-time subscriptions** for live data updates
- **Authentication** with built-in user management
- **Row Level Security (RLS)** policies for data protection
- **Built-in API** for CRUD operations
- **Database migrations** and schema management

### Integration with AI Development

The AI can help you:
- **Design database schemas** for your applications
- **Write SQL queries** and database functions
- **Implement authentication flows**
- **Create API endpoints** for your frontend
- **Set up real-time features** for collaborative apps

Supabase integration makes it easy to build full-stack applications with a robust backend infrastructure.

---

## WebContainer and Live Preview

bolt.diy uses WebContainer technology to provide a secure, isolated development environment with live preview capabilities.

### WebContainer Features

- **Secure sandbox environment** - Run code in isolated containers
- **Live preview** - See your changes instantly without leaving the editor
- **Full Node.js environment** - Run npm scripts, build tools, and development servers
- **File system access** - Direct manipulation of project files
- **Terminal integration** - Execute commands and see real-time output

### Development Workflow

1. **Write code** in the integrated editor
2. **Run development servers** directly in WebContainer
3. **Preview your application** in real-time
4. **Test functionality** with the integrated terminal
5. **Debug issues** with live error reporting

### Supported Technologies

WebContainer supports all major JavaScript frameworks and tools:
- React, Vue, Angular, Svelte
- Next.js, Nuxt, Astro, Remix
- Vite, Webpack, Parcel
- Node.js, npm, pnpm, yarn
- And many more...

The WebContainer integration provides a seamless development experience without the need for local setup.

---

## Project Templates

bolt.diy comes with a comprehensive collection of starter templates to help you quickly bootstrap your projects. Choose from popular frameworks and technologies:

### Frontend Frameworks
- **React + Vite** - Modern React setup with TypeScript
- **Vue.js** - Progressive JavaScript framework
- **Angular** - Enterprise-ready framework
- **Svelte** - Compiler-based framework for fast apps
- **SolidJS** - Reactive framework with fine-grained updates

### Full-Stack Frameworks
- **Next.js with shadcn/ui** - React framework with UI components
- **Astro** - Static site generator for content-focused sites
- **Qwik** - Resumable framework for instant loading
- **Remix** - Full-stack React framework
- **Nuxt** - Vue.js meta-framework

### Mobile & Cross-Platform
- **Expo App** - React Native with Expo
- **React Native** - Cross-platform mobile development

### Presentation & Content
- **Slidev** - Developer-friendly presentations
- **Astro Basic** - Lightweight static sites

### Vanilla JavaScript
- **Vanilla Vite** - Minimal JavaScript setup
- **Vite TypeScript** - TypeScript without framework

### Getting Started with Templates

1. Start a new project in bolt.diy
2. Browse available templates in the starter selection
3. Select your preferred technology stack
4. The AI will scaffold your project with best practices
5. Begin development immediately with live preview

All templates are pre-configured with modern tooling, linting, and build processes for immediate productivity.

---

## Available Scripts

### Development Scripts
- `pnpm run dev`: Starts the development server with hot reloading
- `pnpm run build`: Builds the project for production
- `pnpm run start`: Runs the built application locally using Wrangler Pages
- `pnpm run preview`: Builds and starts locally for production testing
- `pnpm test`: Runs the test suite using Vitest
- `pnpm run test:watch`: Runs tests in watch mode
- `pnpm run lint`: Runs ESLint with auto-fix
- `pnpm run typecheck`: Runs TypeScript type checking
- `pnpm run typegen`: Generates TypeScript types using Wrangler

### Docker Scripts
- `pnpm run dockerbuild`: Builds Docker image for development
- `pnpm run dockerbuild:prod`: Builds Docker image for production
- `pnpm run dockerrun`: Runs the Docker container
- `docker compose --profile development up`: Runs with Docker Compose (development)

### Electron Scripts
- `pnpm electron:build:mac`: Builds for macOS
- `pnpm electron:build:win`: Builds for Windows
- `pnpm electron:build:linux`: Builds for Linux
- `pnpm electron:build:dist`: Builds for all platforms (Mac, Windows, Linux)
- `pnpm electron:build:unpack`: Creates unpacked build for testing

### Deployment Scripts
- `pnpm run deploy`: Builds and deploys to Cloudflare Pages
- `npm run dockerbuild`: Alternative Docker build command

### Utility Scripts
- `pnpm run clean`: Cleans build artifacts
- `pnpm run prepare`: Sets up Husky for git hooks

---

## Development

To start the development server:

```bash
pnpm run dev
```

This will start the Remix Vite development server. You will need Google Chrome Canary to run this locally if you use Chrome! It's an easy install and a good browser for web development anyway.

---

## Getting Help & Resources

### Help Icon in Sidebar
bolt.diy includes a convenient help icon (?) in the sidebar that provides quick access to comprehensive documentation. Simply click the help icon to open the full documentation in a new tab.

The documentation includes:
- **Complete setup guides** for all supported providers
- **Feature explanations** for advanced capabilities
- **Troubleshooting guides** for common issues
- **Best practices** for optimal usage
- **FAQ section** with detailed answers

### Community Support
- **GitHub Issues**: Report bugs and request features
- **Community Forum**: Join discussions at [thinktank.ottomator.ai](https://thinktank.ottomator.ai)
- **Contributing Guide**: Learn how to contribute to the project

## Tips and Tricks

Here are some tips to get the most out of bolt.diy:

- **Be specific about your stack**: If you want to use specific frameworks or libraries (like Astro, Tailwind, ShadCN, or any other popular JavaScript framework), mention them in your initial prompt to ensure Bolt scaffolds the project accordingly.

- **Use the enhance prompt icon**: Before sending your prompt, try clicking the 'enhance' icon to have the AI model help you refine your prompt, then edit the results before submitting.

- **Scaffold the basics first, then add features**: Make sure the basic structure of your application is in place before diving into more advanced functionality. This helps Bolt understand the foundation of your project and ensure everything is wired up right before building out more advanced functionality.

- **Batch simple instructions**: Save time by combining simple instructions into one message. For example, you can ask Bolt to change the color scheme, add mobile responsiveness, and restart the dev server, all in one go saving you time and reducing API credit consumption significantly.

- **Access documentation quickly**: Use the help icon (?) in the sidebar for instant access to guides, troubleshooting, and best practices.

# Frequently Asked Questions (FAQ)

<details>
<summary><strong>What are the best models for bolt.diy?</strong></summary>

For the best experience with bolt.diy, we recommend using the following models:

**Recommended for Production:**
- **Claude 4 Opus**: Flagship model with enhanced reasoning (200K context)
- **Claude 3.5 Sonnet**: Proven excellent performance across all tasks
- **GPT-4o**: Strong general-purpose coding with great reliability
- **xAI Grok 4**: 256K context window for large projects

**Fast & Efficient:**
- **Gemini 2.0 Flash**: Exceptional speed for rapid development
- **Claude 3 Haiku**: Cost-effective for simpler tasks
- **xAI Grok 3 Mini Fast**: Optimized for speed and efficiency

**Advanced Reasoning:**
- **Moonshot AI Kimi K2**: Advanced reasoning with 128K context
- **Moonshot AI Kimi Thinking**: Specialized for complex reasoning tasks

**Open Source & Self-Hosting:**
- **DeepSeekCoder V3**: Outstanding open-source model
- **DeepSeekCoder V2 236b**: Powerful self-hosted option
- **Qwen 2.5 Coder 32b**: Good balance of performance and resource requirements

**Local Models (Ollama):**
- Best for privacy and offline development
- Use 7B+ parameter models for reasonable performance

</details>

<details>
<summary><strong>How do I get the best results with bolt.diy?</strong></summary>

- **Be specific about your stack**:  
  Mention the frameworks or libraries you want to use (e.g., Astro, Tailwind, ShadCN) in your initial prompt. This ensures that bolt.diy scaffolds the project according to your preferences.

- **Use the enhance prompt icon**:  
  Before sending your prompt, click the _enhance_ icon to let the AI refine your prompt. You can edit the suggested improvements before submitting.

- **Scaffold the basics first, then add features**:  
  Ensure the foundational structure of your application is in place before introducing advanced functionality. This helps bolt.diy establish a solid base to build on.

- **Batch simple instructions**:  
  Combine simple tasks into a single prompt to save time and reduce API credit consumption. For example:  
  _"Change the color scheme, add mobile responsiveness, and restart the dev server."_
</details>

<details>
<summary><strong>How do I contribute to bolt.diy?</strong></summary>

Check out our [Contribution Guide](CONTRIBUTING.md) for more details on how to get involved!

</details>

<details>
<summary><strong>What are the future plans for bolt.diy?</strong></summary>

Visit our [Roadmap](https://roadmap.sh/r/ottodev-roadmap-2ovzo) for the latest updates.  
New features and improvements are on the way!

</details>

<details>
<summary><strong>Why are there so many open issues/pull requests?</strong></summary>

bolt.diy began as a small showcase project on @ColeMedin's YouTube channel to explore editing open-source projects with local LLMs. However, it quickly grew into a massive community effort!

We're forming a team of maintainers to manage demand and streamline issue resolution. The maintainers are rockstars, and we're also exploring partnerships to help the project thrive.

</details>

<details>
<summary><strong>How do local LLMs compare to larger models like Claude 3.5 Sonnet for bolt.diy?</strong></summary>

While local LLMs are improving rapidly, larger models like GPT-4o, Claude 3.5 Sonnet, and DeepSeek Coder V2 236b still offer the best results for complex applications. Our ongoing focus is to improve prompts, agents, and the platform to better support smaller local LLMs.

</details>

<details>
<summary><strong>Common Errors and Troubleshooting</strong></summary>

### **"There was an error processing this request"**
This generic error message means something went wrong. Check these locations:
- Terminal output (if using Docker or `pnpm`)
- Browser developer console (press `F12` -> Console tab)
- Server logs for backend errors
- Network tab to verify API calls are succeeding

### **"x-api-key header missing"**
This authentication error can be resolved by:
- Restarting the container: `docker compose restart`
- Switching run methods: Try `pnpm` if using Docker, or vice versa
- Checking API keys in `.env.local` or Settings -> Providers
- Clearing browser cache

### **Blank preview when running the app**
Blank previews usually indicate code generation issues:
- Check developer console for JavaScript runtime errors
- Verify WebContainer is running properly
- Try refreshing the preview pane
- Check for hallucinated or incomplete code in generated files
- Restart the development server if issues persist

### **MCP server connection failed**
If you're having trouble with MCP integrations:
- Verify server configuration in Settings -> MCP
- Check server endpoints and authentication credentials
- Test server connectivity outside of bolt.diy
- Review MCP server logs for specific errors
- Ensure server supports the MCP protocol version

### **Git integration not working**
Common Git-related issues and solutions:
- GitHub connection failed: Verify your GitHub token has correct permissions
- Repository not found: Check repository URL and access permissions
- Push/pull failed: Ensure you have write access to the repository
- Merge conflicts: Resolve conflicts manually or use the diff viewer
- Large files blocked: Check GitHub's file size limits

### **Deployment failed**
Deployment issues can be resolved by:
- Checking build logs for specific error messages
- Verifying environment variables are set correctly
- Testing locally before deploying (`pnpm run build && pnpm run preview`)
- Checking platform-specific requirements (Node version, build commands)
- Reviewing deployment configuration in platform settings

### **Provider not showing up after adding it**
If your custom LLM provider isn't appearing:
- Restart the development server to reload providers
- Check the provider registry in `app/lib/modules/llm/registry.ts`
- Verify the provider class extends `BaseProvider` correctly and returns `LanguageModel` from `'ai'`
- Check browser console for provider loading errors
- Ensure proper TypeScript compilation (`pnpm run typecheck`)

### **WebContainer preview not loading**
If the live preview isn't working:
- Check WebContainer status in the terminal
- Verify Node.js compatibility with your project
- Restart the development environment
- Clear browser cache and reload
- Check for conflicting ports (default is 5173)

### **"Everything works, but the results are bad"**
Local LLMs like Qwen-2.5-Coder are powerful for small applications but still experimental for larger projects. For better results, consider using larger models like GPT-4o, Claude 3.5 Sonnet, or Claude 4 Opus.

### **"Received structured exception #0xc0000005: access violation"**
**Windows-specific issue**: Update the [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170).

### **"Miniflare or Wrangler errors in Windows"**
**Windows development environment**: Install Visual Studio C++ (version 14.40.33816 or later). More details in [GitHub Issues](https://github.com/stackblitz-labs/bolt.diy/issues/19).

</details>

---

Got more questions? Feel free to reach out or open an issue in our GitHub repo!

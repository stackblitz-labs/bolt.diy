interface Env {
  RUNNING_IN_DOCKER: Settings;
  DEFAULT_NUM_CTX: Settings;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GROQ_API_KEY: string;
  HuggingFace_API_KEY: string;
  OPEN_ROUTER_API_KEY: string;
  OLLAMA_API_BASE_URL: string;
  OPENAI_LIKE_API_KEY: string;
  OPENAI_LIKE_API_BASE_URL: string;
  OPENAI_LIKE_API_MODELS: string;
  TOGETHER_API_KEY: string;
  TOGETHER_API_BASE_URL: string;
  DEEPSEEK_API_KEY: string;
  LMSTUDIO_API_BASE_URL: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  MISTRAL_API_KEY: string;
  XAI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  AWS_BEDROCK_CONFIG: string;

  // GitHub API token for template fetching
  GITHUB_TOKEN?: string;

  // AWS Amplify deployment credentials
  AMPLIFY_ACCESS_KEY_ID?: string;
  AMPLIFY_SECRET_ACCESS_KEY?: string;
  AMPLIFY_REGION?: string;
  AMPLIFY_APP_ID?: string;

  // Cloudflare Workers deployment credentials
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_NAME?: string;

  // Langfuse LLM Observability
  LANGFUSE_ENABLED?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}

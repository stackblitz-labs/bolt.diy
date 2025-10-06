# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# CI-friendly env
ENV HUSKY=0
ENV CI=true

# Use pnpm
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Accept (optional) build-time public URL for Remix/Vite (Coolify can pass it)
ARG VITE_PUBLIC_APP_URL
ENV VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL}

# Install deps efficiently
COPY package.json pnpm-lock.yaml* ./
RUN pnpm fetch

# Copy source and build
COPY . .
# install with dev deps (needed to build)
RUN pnpm install --offline --frozen-lockfile

# Build the Remix app (SSR + client)
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build


# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Install curl so Coolify’s healthcheck works inside the image
RUN apt-get update && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm (needed for dockerstart script)
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Copy built application and dependencies (including wrangler)
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json

# Copy required files for wrangler pages dev
COPY --from=build /app/bindings.sh /app/bindings.sh
COPY --from=build /app/wrangler.toml /app/wrangler.toml
COPY --from=build /app/functions /app/functions
COPY --from=build /app/worker-configuration.d.ts /app/worker-configuration.d.ts

# Make bindings.sh executable
RUN chmod +x /app/bindings.sh

EXPOSE 5173

# Healthcheck for Coolify (use correct port)
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS http://localhost:5173/ || exit 1

# Start with wrangler pages dev (as per dockerstart script)
CMD ["pnpm", "run", "dockerstart"]


# ---- railway stage (for Railway deployment with Wrangler) ----
FROM node:22-bookworm-slim AS railway
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

# Install curl and bash for healthchecks and scripts
RUN apt-get update && apt-get install -y --no-install-recommends curl bash \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm (needed for start:railway script)
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

# Copy built application and dependencies (includes wrangler)
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/wrangler.toml /app/wrangler.toml
COPY --from=build /app/functions /app/functions
COPY --from=build /app/worker-configuration.d.ts /app/worker-configuration.d.ts

EXPOSE 5173

# Healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD curl -fsS http://localhost:5173/ || exit 1

# Start with wrangler pages dev (works on Railway)
CMD ["pnpm", "run", "start:railway"]


# ---- development stage ----
FROM build AS development

# Define environment variables for development
ARG GROQ_API_KEY
ARG HuggingFace_API_KEY
ARG OPENAI_API_KEY
ARG ANTHROPIC_API_KEY
ARG OPEN_ROUTER_API_KEY
ARG GOOGLE_GENERATIVE_AI_API_KEY
ARG OLLAMA_API_BASE_URL
ARG XAI_API_KEY
ARG TOGETHER_API_KEY
ARG TOGETHER_API_BASE_URL
ARG AWS_BEDROCK_CONFIG
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

ENV GROQ_API_KEY=${GROQ_API_KEY} \
    HuggingFace_API_KEY=${HuggingFace_API_KEY} \
    OPENAI_API_KEY=${OPENAI_API_KEY} \
    ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
    OPEN_ROUTER_API_KEY=${OPEN_ROUTER_API_KEY} \
    GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY} \
    OLLAMA_API_BASE_URL=${OLLAMA_API_BASE_URL} \
    XAI_API_KEY=${XAI_API_KEY} \
    TOGETHER_API_KEY=${TOGETHER_API_KEY} \
    TOGETHER_API_BASE_URL=${TOGETHER_API_BASE_URL} \
    AWS_BEDROCK_CONFIG=${AWS_BEDROCK_CONFIG} \
    VITE_LOG_LEVEL=${VITE_LOG_LEVEL} \
    DEFAULT_NUM_CTX=${DEFAULT_NUM_CTX} \
    RUNNING_IN_DOCKER=true

RUN mkdir -p /app/run
CMD ["pnpm", "run", "dev", "--host"]

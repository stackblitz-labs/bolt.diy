# Use Dockerfile syntax version for better caching and future features
# syntax=docker/dockerfile:1
# Some M3 macOS fresh installs with fresh dockers with fresh nodejs. installs may experience this issue
# Base image with Node.js (with version as a build argument)
ARG BASE=node:20.18.0
FROM ${BASE} AS base

WORKDIR /app

# Copy dependency files first to leverage Docker cache when dependencies haven’t changed
COPY package.json pnpm-lock.yaml ./

# Enable Corepack, prepare a specific PNPM version (replace with your desired version),
# and install dependencies with a frozen lockfile for consistency.
RUN corepack enable pnpm \
    && corepack prepare pnpm@8.7.0 --activate \
    && pnpm install --frozen-lockfile

# Copy the rest of your application code.
COPY . .

# Expose the port your app uses.
EXPOSE 5173

#################################################
# Production Stage
#################################################
FROM base AS bolt-ai-production

# Define build-time variables (they can be overridden at build-time)
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

# Set environment variables using the build-time args
ENV WRANGLER_SEND_METRICS=false \
    GROQ_API_KEY=${GROQ_API_KEY} \
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

# Pre-configure wrangler to disable metrics collection
RUN mkdir -p /root/.config/.wrangler \
    && echo '{"enabled":false}' > /root/.config/.wrangler/metrics.json

# Build the production assets
RUN pnpm run build

# Define the command to start your app in production
CMD ["pnpm", "run", "dockerstart"]

#################################################
# Development Stage
#################################################
FROM base AS bolt-ai-development

# Define the same build-time variables for development.
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
ARG VITE_LOG_LEVEL=debug
ARG DEFAULT_NUM_CTX

# Set environment variables
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

# Create a directory for any runtime files if needed.
RUN mkdir -p ${WORKDIR}/run

# Start the development server
CMD ["pnpm", "run", "dev", "--host"]

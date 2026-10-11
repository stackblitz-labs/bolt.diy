# Contribution Guidelines

Welcome! This guide provides all the details you need to contribute effectively to the project. Thank you for helping us make **bolt.diy** a better tool for developers worldwide. 💡

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
3. [Pull Request Guidelines](#pull-request-guidelines)
4. [Coding Standards](#coding-standards)
5. [Development Setup](#development-setup)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Docker Deployment](#docker-deployment)
9. [VS Code Dev Containers Integration](#vs-code-dev-containers-integration)

---

## 🛡️ Code of Conduct

This project is governed by our **Code of Conduct**. By participating, you agree to uphold this code. Report unacceptable behavior to the project maintainers.

---

## 🛠️ How Can I Contribute?

### 1️⃣ Reporting Bugs or Feature Requests

- Check the [issue tracker](#) to avoid duplicates.
- Use issue templates (if available).
- Provide detailed, relevant information and steps to reproduce bugs.

### 2️⃣ Code Contributions

1. Fork the repository.
2. Create a feature or fix branch.
3. Write and test your code.
4. Submit a pull request (PR).

### 3️⃣ Join as a Core Contributor

Interested in maintaining and growing the project? Fill out our [Contributor Application Form](https://forms.gle/TBSteXSDCtBDwr5m7).

---

## ✅ Pull Request Guidelines

### PR Checklist

- Branch from the **main** branch.
- Update documentation, if needed.
- Test all functionality manually.
- Focus on one feature/bug per PR.

### Review Process

1. Manual testing by reviewers.
2. At least one maintainer review required.
3. Address review comments.
4. Maintain a clean commit history.

---

## 📏 Coding Standards

### General Guidelines

- Follow existing code style.
- Comment complex logic.
- Keep functions small and focused.
- Use meaningful variable names.

---

## 🖥️ Development Setup

### 1️⃣ Initial Setup

- Prerequisites: **Node.js >= 22.12.0** and **pnpm >= 9.15.9**.
- Clone the repository:
  ```bash
  git clone https://github.com/stackblitz-labs/bolt.diy.git
  ```
- Install dependencies:
  ```bash
  pnpm install
  ```
- Set up environment variables:
  1. Rename `.env.example` to `.env.local`.
  2. Add your API keys:
     ```bash
     GROQ_API_KEY=XXX
     HuggingFace_API_KEY=XXX
     OPENAI_API_KEY=XXX
     ...
     ```
  3. **For Docker users**: Run the setup script or manually copy `.env.local` to `.env`:
     ```bash
     # Option 1: Use the setup script
     ./scripts/setup-env.sh
     
     # Option 2: Manual copy
     cp .env.local .env
     ```
     Docker Compose requires `.env` for variable substitution.
  4. Optionally set:
     - Debug level: `VITE_LOG_LEVEL=debug`
     - Context size: `DEFAULT_NUM_CTX=32768`

**Note**: Never commit your `.env.local` or `.env` files to version control. They're already in `.gitignore`.

### 2️⃣ Run Development Server

```bash
pnpm run dev
```

**Tip**: Use **Google Chrome Canary** for local testing.

---

## 🧪 Testing

Run the test suite with:

```bash
# Unit and integration tests
pnpm test

# End-to-end tests
pnpm run test:e2e

# TypeScript type checking
pnpm run typecheck
```

---

## 🚀 Deployment

### Deploy to Cloudflare Workers

```bash
pnpm run deploy
```

Ensure you have required permissions and that Wrangler is configured.

---

## 🐳 Docker Deployment

This section outlines the methods for deploying the application using Docker. The processes for **Development** and **Production** are provided separately for clarity.

---

### 🧑‍💻 Development Environment

#### Build Options

**Option 1: Helper Scripts**

```bash
# Development build
npm run dockerbuild
```

**Option 2: Direct Docker Build Command**

```bash
docker build . --target bolt-ai-development
```

**Option 3: Docker Compose Profile**

```bash
docker compose --profile development up
```

#### Running the Development Container

```bash
docker run -p 5173:5173 --env-file .env.local bolt-ai:development
```

---

### 🏭 Production Environment

#### Build Options

**Option 1: Helper Scripts**

```bash
# Production build
npm run dockerbuild:prod
```

**Option 2: Direct Docker Build Command**

```bash
docker build . --target bolt-ai-production
```

**Option 3: Docker Compose Profile**

```bash
docker compose --profile production up
```

#### Running the Production Container

```bash
docker run -p 5173:5173 --env-file .env.local bolt-ai:production
```

---

### Coolify Deployment

For an easy deployment process, use [Coolify](https://github.com/coollabsio/coolify):

1. Import your Git repository into Coolify.
2. Choose **Docker Compose** as the build pack.
3. Configure environment variables (e.g., API keys).
4. Set the start command:
   ```bash
   docker compose --profile production up
   ```

---

## 🛠️ VS Code Dev Containers Integration

The `docker-compose.yaml` configuration is compatible with **VS Code Dev Containers**, making it easy to set up a development environment directly in Visual Studio Code.

### Steps to Use Dev Containers

1. Open the command palette in VS Code (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS).
2. Select **Dev Containers: Reopen in Container**.
3. Choose the **development** profile when prompted.
4. VS Code will rebuild the container and open it with the pre-configured environment.

---

## 🔑 Environment Variables

Ensure `.env.local` is configured correctly with:

- API keys.
- Context-specific configurations.

Example for the `DEFAULT_NUM_CTX` variable:

```bash
DEFAULT_NUM_CTX=24576 # Uses 32GB VRAM
```

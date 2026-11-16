# Contributing to bolt.diy

Contributions are welcome. Please read the repository's [Contributing Guide](https://github.com/stackblitz-labs/bolt.diy/blob/main/CONTRIBUTING.md) for project-specific expectations before opening an issue or pull request.

## Development setup

Requirements: Node.js **22.12.0 or later** and pnpm **9.15.9 or later**. The supported versions are declared in [`package.json`](https://github.com/stackblitz-labs/bolt.diy/blob/main/package.json).

```bash
git clone https://github.com/stackblitz-labs/bolt.diy.git
cd bolt.diy
pnpm install
cp .env.example .env.local
```

Edit `.env.local` with credentials for providers you plan to use; remove or comment out unused placeholders. Never commit `.env.local` or `.env`. Docker Compose uses both `.env` and `.env.local`; run `./scripts/setup-env.sh` after configuring `.env.local` and again after changing it.

Start the development server with:

```bash
pnpm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Checks

Choose checks relevant to your change. These commands are defined in the repository's `package.json`:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run test:e2e
```

The unit/integration/performance suite is run with `pnpm test`; Playwright end-to-end tests are a separate command.

## Pull requests

- Use a focused branch and keep the change scoped to a clear issue or feature.
- Include enough context in the PR description to explain the change and how you checked it.
- Update documentation when behavior or setup instructions change.
- Link related issues and address review feedback.

For deployment and Docker commands, refer to the [repository README](https://github.com/stackblitz-labs/bolt.diy#running-with-docker) and the checked-in [Docker Compose configuration](https://github.com/stackblitz-labs/bolt.diy/blob/main/docker-compose.yaml). Those files are the source of truth as the project evolves.

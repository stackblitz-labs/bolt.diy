
## Nut

Nut is an open source fork of Bolt.new for helping you develop full stack apps using AI. AI developers frequently struggle with fixing even simple bugs when they don't know the cause, and get stuck making ineffective changes over and over. We want to crack these tough nuts, so to speak, so you can get back to building.

When you ask Nut to fix a bug, it creates a Replay.io recording of your app and whatever you did to produce the bug. The recording captures all the runtime behavior of your app, which is analyzed to explain the bug's root cause. This explanation is given to the AI developer so it has context to write a good fix.

## Setup

```
pnpm install
pnpm build
pnpm dev
```

### Local/Ephemeral Backend Configuration

If you want to use local or ephemeral backends instead of the default production services, you can override the Nut backend API host:

- `VITE_REPLAY_API_HOST` - Override the Nut backend API host (default: `https://dispatch.replay.io`)

Add this to your `.env` file to point to your local backend service.

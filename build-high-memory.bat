@echo off
echo Running build with increased memory limits...
set NODE_OPTIONS=--max-old-space-size=8192
pnpm build
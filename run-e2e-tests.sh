#!/bin/bash

# E2E Test Runner Script for Bolt.diy
# This script runs the complete E2E test suite using Playwright

echo "🚀 Starting Bolt.diy E2E Test Suite"
echo "===================================="
echo ""

# Check if API key is available (from env or .env.local)
if [ ! -f .env.local ] && [ -z "$OPEN_ROUTER_API_KEY" ]; then
    echo "⚠️  Warning: No OpenRouter API key found"
    echo "Please either:"
    echo "  1. Create .env.local with OPEN_ROUTER_API_KEY=your-key-here"
    echo "  2. Set OPEN_ROUTER_API_KEY environment variable"
    echo ""
    echo "Continuing anyway - tests may fail if API key is required..."
    echo ""
fi

# Install Playwright browsers if needed
echo "📦 Checking Playwright browsers..."
pnpm exec playwright install chromium --with-deps

echo ""
echo "🧪 Running E2E Tests..."
echo ""

# Run tests and capture exit code
pnpm exec playwright test --config=playwright.config.e2e.ts
TEST_EXIT_CODE=$?

# Check exit code
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All E2E tests passed!"
    echo ""
    echo "📊 View detailed report:"
    echo "   pnpm exec playwright show-report"
    exit 0
else
    echo ""
    echo "❌ Some tests failed"
    echo ""
    echo "📊 View detailed report:"
    echo "   pnpm exec playwright show-report"
    exit $TEST_EXIT_CODE
fi

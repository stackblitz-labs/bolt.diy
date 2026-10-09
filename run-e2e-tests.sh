#!/bin/bash

# E2E Test Runner Script for Bolt.diy
# This script runs the complete E2E test suite using Playwright

set -e  # Exit on error

echo "🚀 Starting Bolt.diy E2E Test Suite"
echo "===================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "Please create .env.local with your OPEN_ROUTER_API_KEY"
    echo "Example: OPEN_ROUTER_API_KEY=your-key-here"
    exit 1
fi

# Install Playwright browsers if needed
echo "📦 Checking Playwright browsers..."
pnpm exec playwright install chromium --with-deps

echo ""
echo "🧪 Running E2E Tests..."
echo ""

# Run tests
pnpm exec playwright test --config=playwright.config.e2e.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All E2E tests passed!"
    echo ""
    echo "📊 View detailed report:"
    echo "   pnpm exec playwright show-report"
else
    echo ""
    echo "❌ Some tests failed"
    echo ""
    echo "📊 View detailed report:"
    echo "   pnpm exec playwright show-report"
    exit 1
fi

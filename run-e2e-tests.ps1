# E2E Test Runner Script for Bolt.diy (PowerShell)
# This script runs the complete E2E test suite using Playwright

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Bolt.diy E2E Test Suite" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if API key is available (from env or .env.local)
if (!(Test-Path .env.local) -and !$env:OPEN_ROUTER_API_KEY) {
    Write-Host "⚠️  Warning: No OpenRouter API key found" -ForegroundColor Yellow
    Write-Host "Please either:" -ForegroundColor Yellow
    Write-Host "  1. Create .env.local with OPEN_ROUTER_API_KEY=your-key-here" -ForegroundColor Yellow
    Write-Host "  2. Set OPEN_ROUTER_API_KEY environment variable" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Continuing anyway - tests may fail if API key is required..." -ForegroundColor Yellow
    Write-Host ""
}

# Install Playwright browsers if needed
Write-Host "📦 Checking Playwright browsers..." -ForegroundColor Cyan
# Note: --with-deps is not supported on Windows, so we only install the browser
pnpm exec playwright install chromium

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Playwright browser installation failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Red
    Write-Host "On Windows, you may need to install browser dependencies manually." -ForegroundColor Yellow
    Write-Host "See: https://playwright.dev/docs/browsers#install-system-dependencies" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🧪 Running E2E Tests..." -ForegroundColor Cyan
Write-Host ""

# Run tests
pnpm exec playwright test --config=playwright.config.e2e.ts

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ All E2E tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 View detailed report:" -ForegroundColor Cyan
    Write-Host "   pnpm exec playwright show-report" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Some tests failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "📊 View detailed report:" -ForegroundColor Cyan
    Write-Host "   pnpm exec playwright show-report" -ForegroundColor White
    exit 1
}

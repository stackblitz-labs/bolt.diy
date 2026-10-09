# E2E Test Runner Script for Bolt.diy (PowerShell)
# This script runs the complete E2E test suite using Playwright

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Bolt.diy E2E Test Suite" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (!(Test-Path .env.local)) {
    Write-Host "⚠️  Warning: .env.local not found" -ForegroundColor Yellow
    Write-Host "Please create .env.local with your OPEN_ROUTER_API_KEY" -ForegroundColor Yellow
    Write-Host "Example: OPEN_ROUTER_API_KEY=your-key-here" -ForegroundColor Yellow
    exit 1
}

# Install Playwright browsers if needed
Write-Host "📦 Checking Playwright browsers..." -ForegroundColor Cyan
pnpm exec playwright install chromium --with-deps

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

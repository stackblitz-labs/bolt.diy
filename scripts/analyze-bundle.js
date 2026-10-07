/**
 * Bundle Size Analyzer
 * Check bundle sizes against performance budgets
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const BUILD_DIR = join(process.cwd(), 'build', 'client');
const BUDGETS_FILE = join(process.cwd(), '.performance-budgets.json');

function getFileSize(filePath) {
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content);
  return {
    raw: content.length,
    gzipped: gzipped.length,
  };
}

function analyzeDirectory(dir, pattern = /\.js$/) {
  const files = readdirSync(dir, { recursive: true });
  const results = [];

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stats = statSync(filePath);

    if (stats.isFile() && pattern.test(file)) {
      const size = getFileSize(filePath);
      results.push({
        name: file,
        path: filePath,
        ...size,
      });
    }
  });

  return results;
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function checkAgainstBudgets(bundles, budgets) {
  const results = [];

  bundles.forEach((bundle) => {
    const sizeKB = bundle.gzipped / 1024;
    let budget = null;
    let budgetName = null;

    // Try to match bundle to a budget
    if (bundle.name.includes('index')) {
      budget = budgets.budgets['bundle-size']['main-bundle'];
      budgetName = 'main-bundle';
    } else if (bundle.name.includes('vendor') || bundle.name.includes('node_modules')) {
      budget = budgets.budgets['bundle-size']['vendor-bundle'];
      budgetName = 'vendor-bundle';
    } else if (bundle.name.includes('webcontainer')) {
      budget = budgets.budgets['bundle-size']['webcontainer-api'];
      budgetName = 'webcontainer-api';
    }

    if (budget) {
      const withinBudget = sizeKB <= budget.budget;
      results.push({
        bundle: bundle.name,
        size: sizeKB,
        budget: budget.budget,
        budgetName,
        withinBudget,
        difference: sizeKB - budget.budget,
      });
    }
  });

  return results;
}

function generateReport() {
  console.log('\n=== Bundle Size Analysis ===\n');

  try {
    const bundles = analyzeDirectory(BUILD_DIR);
    const budgets = JSON.parse(readFileSync(BUDGETS_FILE, 'utf-8'));

    // Sort by size
    bundles.sort((a, b) => b.gzipped - a.gzipped);

    console.log('All JavaScript Bundles:');
    console.log(''.padEnd(60, '-'));
    bundles.forEach((bundle) => {
      const name = bundle.name.padEnd(40);
      const size = formatSize(bundle.gzipped).padStart(12);
      console.log(`${name} ${size}`);
    });

    console.log('\nTotal:');
    const totalGzipped = bundles.reduce((sum, b) => sum + b.gzipped, 0);
    console.log(`${formatSize(totalGzipped)} (gzipped)`);

    // Check against budgets
    console.log('\n=== Budget Compliance ===\n');
    const budgetResults = checkAgainstBudgets(bundles, budgets);

    if (budgetResults.length === 0) {
      console.log('⚠️  No budgets matched to bundles');
    } else {
      budgetResults.forEach((result) => {
        const status = result.withinBudget ? '✅' : '❌';
        const diff = result.withinBudget
          ? `(${formatSize(result.budget * 1024 - result.size * 1024)} under budget)`
          : `(${formatSize(result.difference * 1024)} over budget)`;

        console.log(
          `${status} ${result.budgetName}: ${formatSize(result.size * 1024)} / ${formatSize(result.budget * 1024)} ${diff}`,
        );
      });

      const failures = budgetResults.filter((r) => !r.withinBudget);
      if (failures.length > 0) {
        console.log(`\n❌ ${failures.length} bundle(s) exceeded budget`);
        process.exit(1);
      } else {
        console.log('\n✅ All bundles within budget');
      }
    }
  } catch (error) {
    console.error('Error analyzing bundles:', error.message);
    console.log('\n⚠️  Build directory may not exist. Run `pnpm run build` first.');
    process.exit(1);
  }
}

generateReport();

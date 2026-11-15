/**
 * Performance Budget Checker
 * Enforces CI ratchets - budgets can only go down, never up
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const TOLERANCE = 0.02; // 2% tolerance for measurement noise

function loadBudgets() {
  const budgetPath = join(process.cwd(), '.performance-budgets.json');
  return JSON.parse(readFileSync(budgetPath, 'utf-8'));
}

function checkBudget(category, name, actual, budget, unit) {
  const tolerance = budget * TOLERANCE;
  const threshold = budget + tolerance;

  if (actual > threshold) {
    return {
      passed: false,
      category,
      name,
      actual,
      budget,
      unit,
      exceeded: actual - budget,
      message: `❌ ${category}/${name}: ${actual}${unit} exceeds budget of ${budget}${unit} (by ${(actual - budget).toFixed(2)}${unit})`,
    };
  }

  if (actual < budget * 0.9) {
    // Actual is 10% better - suggest updating the budget
    return {
      passed: true,
      category,
      name,
      actual,
      budget,
      unit,
      improvement: budget - actual,
      message: `✅ ${category}/${name}: ${actual}${unit} (budget: ${budget}${unit}) - Consider ratcheting down budget!`,
    };
  }

  return {
    passed: true,
    category,
    name,
    actual,
    budget,
    unit,
    message: `✅ ${category}/${name}: ${actual}${unit} (budget: ${budget}${unit})`,
  };
}

function generateReport(results) {
  const failures = results.filter((r) => !r.passed);
  const improvements = results.filter((r) => r.passed && r.improvement);

  console.log('\n=== Performance Budget Report ===\n');

  if (failures.length > 0) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log(f.message));
    console.log('');
  }

  if (improvements.length > 0) {
    console.log('IMPROVEMENTS (Consider updating budgets):');
    improvements.forEach((i) => console.log(i.message));
    console.log('');
  }

  console.log('SUMMARY:');
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Improvements: ${improvements.length}`);

  return failures.length === 0;
}

// Example usage - this would be called with actual metrics from tests
function runBudgetCheck(metrics) {
  const budgets = loadBudgets();
  const results = [];

  // Check each metric against its budget
  Object.entries(metrics).forEach(([category, categoryMetrics]) => {
    Object.entries(categoryMetrics).forEach(([name, actual]) => {
      const budgetEntry = budgets.budgets[category]?.[name];
      if (budgetEntry) {
        results.push(checkBudget(category, name, actual, budgetEntry.budget, budgetEntry.unit));
      }
    });
  });

  const success = generateReport(results);
  process.exit(success ? 0 : 1);
}

// Export for use in tests
export { loadBudgets, checkBudget, generateReport, runBudgetCheck };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Performance Budget Checker');
  console.log('Usage: node scripts/check-performance-budgets.js <metrics.json>');
  console.log('');
  console.log('Or run with example data:');

  // Example metrics (in a real scenario, these come from test runs)
  const exampleMetrics = {
    'core-journeys': {
      'composer-typeable': 95, // Better than budget!
      'message-first-token': 280,
      'project-load': 720,
    },
    'component-performance': {
      'code-block-render': 105, // Slightly over budget
      'message-render': 45,
    },
  };

  runBudgetCheck(exampleMetrics);
}

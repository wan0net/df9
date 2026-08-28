import { readFileSync } from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) throw new Error('Usage: node scripts/assert-playwright-skips.mjs <json-report>');

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const allowed = new Set([
  'mine command queues when clicking asteroid in M mode',
  'fire spreads to adjacent tiles',
  'characters eat when hungry and food is available',
  'skeletal animations loaded from GLB models',
]);
const skipped = [];

function visitSuite(suite) {
  for (const spec of suite.specs ?? []) {
    if (spec.tests?.some(test => test.results?.some(result => result.status === 'skipped'))) {
      skipped.push(spec.title);
    }
  }
  for (const child of suite.suites ?? []) visitSuite(child);
}

for (const suite of report.suites ?? []) visitSuite(suite);
const unexpected = skipped.filter(title => !allowed.has(title));
if (unexpected.length > 0) {
  throw new Error(`Unexpected skipped Playwright tests: ${unexpected.join(', ')}`);
}
console.log(`Playwright skip gate: ${skipped.length} known skips, 0 unexpected.`);

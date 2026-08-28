#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .sort();

const forbiddenPrefixes = [
  '.claude/', '.playwright-mcp/', 'coverage/', 'dist/', 'extracted_assets/',
  'node_modules/', 'spacebase-v2-updated-code-master/', 'test-results/',
];
const forbiddenExtensions = new Set(['.dll', '.dmg', '.exe', '.iso', '.log', '.sav']);
const forbiddenNames = new Set(['.DS_Store']);
const required = [
  '.github/workflows/pages.yml', 'ASSET-NOTICE.md', 'LEGAL.md', 'LICENSE',
  'README.md', 'game.html', 'index.html', 'public/.nojekyll',
];

const rejected = tracked.filter(file =>
  forbiddenPrefixes.some(prefix => file.startsWith(prefix))
  || forbiddenExtensions.has(path.extname(file).toLowerCase())
  || forbiddenNames.has(path.basename(file))
);
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));

const sourceFiles = tracked.filter(file => file === 'index.html' || file === 'game.html' || file.startsWith('src/'));
const rootAssetReferences = sourceFiles.flatMap(file => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const hasRootAssetUrl = /(['"`])\/assets\//.test(text)
    || /url\(\s*(['"]?)\/assets\//.test(text);
  return hasRootAssetUrl ? [file] : [];
});

const publicFiles = tracked.filter(file => file.startsWith('public/'));
const publicBytes = publicFiles.reduce((total, file) => total + fs.statSync(path.join(root, file)).size, 0);
const maxPublicBytes = 1024 * 1024 * 1024;

if (rejected.length || missing.length || rootAssetReferences.length || publicBytes > maxPublicBytes) {
  if (rejected.length) console.error(`Forbidden tracked public files:\n${rejected.join('\n')}`);
  if (missing.length) console.error(`Missing publication files:\n${missing.join('\n')}`);
  if (rootAssetReferences.length) console.error(`Root-absolute /assets/ references:\n${rootAssetReferences.join('\n')}`);
  if (publicBytes > maxPublicBytes) console.error(`Public runtime exceeds 1 GiB: ${publicBytes} bytes`);
  process.exit(1);
}

console.log(`Public tree: ${tracked.length} tracked files; ${publicFiles.length} runtime files; ${(publicBytes / 1024 / 1024).toFixed(1)} MiB`);

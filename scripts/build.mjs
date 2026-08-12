#!/usr/bin/env node
// Build-free copy step: assembles dist/<browser> from packages/core plus the
// per-browser manifest. No bundler, no transpilation — just a plain file copy
// that dereferences the dev symlinks so the output is a real, zippable tree.

import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const browser = process.argv[2];

if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node scripts/build.mjs <chrome|firefox>');
  process.exit(1);
}

const appDir = path.join(rootDir, 'apps', browser);
const coreDir = path.join(rootDir, 'packages', 'core');
const outDir = path.join(rootDir, 'dist', browser);

if (!existsSync(appDir)) {
  console.error(`Unknown app directory: ${appDir}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(path.join(coreDir, 'src'), path.join(outDir, 'src'), {
  recursive: true,
  dereference: true,
  filter: (src) => !src.endsWith('.DS_Store'),
});
cpSync(path.join(coreDir, 'assets'), path.join(outDir, 'assets'), {
  recursive: true,
  dereference: true,
  filter: (src) => !src.endsWith('.DS_Store'),
});
cpSync(path.join(appDir, 'manifest.json'), path.join(outDir, 'manifest.json'));

console.log(`Built ${browser} extension: ${path.relative(rootDir, outDir)}`);

#!/usr/bin/env node
/**
 * Stamps a fresh, build-unique cache version into dist/sw.js after `vite build`.
 *
 * Referenced by the "build" script in package.json (`vite build && node
 * scripts/stamp-sw-version.mjs && ...`) but never actually committed — that
 * left every production build failing at this step with MODULE_NOT_FOUND.
 *
 * public/sw.js has historically had its CACHE_NAME bumped by hand on every
 * deploy that needed to force clients to drop their old PWA cache (see git
 * history: "bump cache to v7", "force PWA cache update to v8", etc.). This
 * script automates that: it runs after Vite has copied public/sw.js into
 * dist/sw.js, and rewrites the version suffix on CACHE_NAME to a value
 * that's unique to this build, so every deploy self-invalidates old caches
 * without anyone needing to remember to bump a number by hand.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(__dirname, '..', 'dist', 'sw.js');

if (!existsSync(swPath)) {
  console.warn(`[stamp-sw-version] ${swPath} not found — skipping (nothing to stamp).`);
  process.exit(0);
}

const original = readFileSync(swPath, 'utf8');

// Build-unique, human-scannable stamp: e.g. 20260925142301
const buildStamp = new Date()
  .toISOString()
  .replace(/[-:TZ]/g, '')
  .slice(0, 14);

const CACHE_NAME_RE = /const CACHE_NAME = ['"]([^'"]+)['"];/;
const match = original.match(CACHE_NAME_RE);

if (!match) {
  console.warn('[stamp-sw-version] Could not find `const CACHE_NAME = "...";` in dist/sw.js — leaving it untouched.');
  process.exit(0);
}

// Keep the existing human-readable prefix (e.g. "cognify-v9-unified-cache"),
// replacing/appending only the build stamp so intent stays legible in
// devtools while every build still gets a genuinely unique cache name.
const currentName = match[1];
const baseName = currentName.replace(/-build-\d{14}$/, '');
const stampedName = `${baseName}-build-${buildStamp}`;

const updated = original.replace(CACHE_NAME_RE, `const CACHE_NAME = '${stampedName}';`);
writeFileSync(swPath, updated, 'utf8');

console.log(`[stamp-sw-version] dist/sw.js CACHE_NAME: "${currentName}" -> "${stampedName}"`);

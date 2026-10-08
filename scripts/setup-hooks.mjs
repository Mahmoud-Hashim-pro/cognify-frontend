#!/usr/bin/env node
/**
 * Setup Git Pre-Commit Hook for Cognify Frontend
 * Installs an automatic pre-commit quality gate into .git/hooks/pre-commit
 */
import fs from 'fs';
import path from 'path';

const gitDir = path.resolve(process.cwd(), '.git');
const hooksDir = path.resolve(gitDir, 'hooks');
const preCommitHook = path.resolve(hooksDir, 'pre-commit');

if (!fs.existsSync(gitDir)) {
  console.log('[setup-hooks] No .git directory found. Skipping hook installation.');
  process.exit(0);
}

if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true });
}

const hookContent = `#!/bin/sh
# Cognify Frontend automated pre-commit quality gate
echo "🛡️ Running Cognify Frontend Pre-Commit Quality Gate..."
node scripts/check-and-fix.mjs --fast
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Git commit aborted: Quality gate failed."
  echo "Run 'npm run check:fix' to inspect errors."
  echo ""
  exit 1
fi

exit 0
`;

try {
  fs.writeFileSync(preCommitHook, hookContent, { mode: 0o755 });
  console.log('✅ Cognify Frontend Git pre-commit hook installed successfully in .git/hooks/pre-commit');
} catch (err) {
  console.warn('[setup-hooks] Failed to install pre-commit hook:', err.message);
}

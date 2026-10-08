#!/usr/bin/env node
/**
 * Setup Git Pre-Commit Hook for Cognify
 * Installs an automatic pre-commit quality gate into .git/hooks/pre-commit
 */
import fs from 'fs';
import path from 'path';

// Guard against CI/CD, Vercel, and Production environments where git hooks are irrelevant
if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
  console.log('[setup-hooks] Skipping pre-commit hook setup in CI/Vercel/Production environment.');
  process.exit(0);
}

try {
  const gitDir = path.resolve(process.cwd(), '.git');

  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    console.log('[setup-hooks] No valid .git directory found. Skipping hook installation.');
    process.exit(0);
  }

  const hooksDir = path.resolve(gitDir, 'hooks');
  const preCommitHook = path.resolve(hooksDir, 'pre-commit');

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookContent = `#!/bin/sh
# Cognify automated pre-commit quality gate
echo "🛡️ Running Cognify Pre-Commit Quality Gate & Auto-Fix..."
node scripts/check-and-fix.mjs --fast
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Git commit aborted: Quality gate failed."
  echo "Run 'npm run check:fix' to inspect and auto-fix errors."
  echo ""
  exit 1
fi

exit 0
`;

  fs.writeFileSync(preCommitHook, hookContent, { mode: 0o755 });
  console.log('✅ Cognify Git pre-commit hook installed successfully in .git/hooks/pre-commit');
} catch (err) {
  console.warn('[setup-hooks] Notice: Could not install pre-commit hook:', err.message);
  process.exit(0);
}

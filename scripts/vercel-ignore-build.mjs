import { execFileSync } from 'node:child_process';

const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
const current = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';

if (!previous) {
  console.log('No previous successful deployment SHA; continue build.');
  process.exit(1);
}

let changedFiles;
try {
  changedFiles = execFileSync('git', ['diff', '--name-only', previous, current], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
} catch (error) {
  console.error('Unable to determine changed files; continue build.', error?.message ?? error);
  process.exit(1);
}

if (changedFiles.length === 0) {
  console.log('No changed files detected; skip deployment.');
  process.exit(0);
}

const nonWebPatterns = [
  /(^|\/)README(?:\.|$)/i,
  /\.md$/i,
  /^docs\//,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/,
  /^android\//,
  /^capacitor\.config\./,
];

const webRelevant = changedFiles.filter(
  (file) => !nonWebPatterns.some((pattern) => pattern.test(file)),
);

if (webRelevant.length === 0) {
  console.log('Only non-web files changed; skip Vercel deployment.');
  for (const file of changedFiles) console.log(`- ${file}`);
  process.exit(0);
}

console.log('Web-relevant changes detected; continue Vercel deployment.');
for (const file of webRelevant) console.log(`- ${file}`);
process.exit(1);

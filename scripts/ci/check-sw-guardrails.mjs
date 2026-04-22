import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export function getChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha) {
    console.log('No base/head SHAs provided, skipping service worker guardrail checks.');
    return [];
  }

  const output = execSync(`git diff --name-only ${baseSha} ${headSha}`, {
    encoding: 'utf8'
  });

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

export function parseStaticAssets(swContent) {
  const match = swContent.match(/const\s+STATIC_ASSETS\s*=\s*\[(?<body>[\s\S]*?)\];/);
  if (!match?.groups?.body) {
    throw new Error('Unable to parse STATIC_ASSETS from sw.js');
  }

  const assets = new Set();
  const stringRegex = /'([^']+)'/g;
  let stringMatch = stringRegex.exec(match.groups.body);
  while (stringMatch) {
    assets.add(stringMatch[1]);
    stringMatch = stringRegex.exec(match.groups.body);
  }

  return assets;
}

const isContentFile = (file) => (
  file.endsWith('.html') ||
  file.endsWith('.js') ||
  file.endsWith('.css') ||
  file.startsWith('assets/')
);

export function runCheckSwGuardrails(changedFiles, swContent = readFileSync('sw.js', 'utf8')) {
  const contentFilesChanged = changedFiles.filter(isContentFile);
  const pagesChanged = changedFiles.filter((file) => file.startsWith('pages/') && file.endsWith('.html'));
  const failures = [];

  if (contentFilesChanged.length > 0 && !changedFiles.includes('sw.js')) {
    failures.push(
      [
        'HTML/JS/CSS/assets were changed but sw.js was not updated.',
        'Please increment CACHE_VERSION in sw.js when site assets or source files change.'
      ].join(' ')
    );
  }

  if (pagesChanged.length > 0) {
    const staticAssets = parseStaticAssets(swContent);

    for (const pageFile of pagesChanged) {
      const route = `/${pageFile}`;
      if (!staticAssets.has(route)) {
        failures.push(`Changed page ${pageFile} is missing from STATIC_ASSETS in sw.js (${route}).`);
      }
    }
  }

  return failures;
}

export function main() {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;
  const changedFiles = getChangedFiles(baseSha, headSha);

  if (changedFiles.length === 0) {
    process.exit(0);
  }

  const failures = runCheckSwGuardrails(changedFiles);

  if (failures.length > 0) {
    console.error('Service worker guardrail checks failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Service worker guardrail checks passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

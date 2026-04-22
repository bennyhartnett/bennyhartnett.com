import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function parseStaticAssets(swContent) {
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

function fileExistsFromWebPath(webPath) {
  if (!webPath || webPath.startsWith('http://') || webPath.startsWith('https://') || webPath.startsWith('//')) {
    return true;
  }

  if (webPath === '/' || webPath === '/nuclear') {
    return true;
  }

  const normalized = decodeURIComponent(webPath).replace(/^\//, '');
  return existsSync(resolve(normalized));
}

const failures = [];
const swContent = readFileSync('sw.js', 'utf8');
const staticAssets = parseStaticAssets(swContent);

for (const assetPath of staticAssets) {
  if (!fileExistsFromWebPath(assetPath)) {
    failures.push(`STATIC_ASSETS entry does not exist: ${assetPath}`);
  }
}

const pagePaths = execSync('find pages -maxdepth 1 -type f -name "*.html"', { encoding: 'utf8' })
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const htmlFiles = ['index.html', ...pagePaths];

const pageReferenceRegex = /\/pages\/[A-Za-z0-9._\-%]+\.html/g;
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const matches = content.match(pageReferenceRegex) ?? [];
  for (const ref of matches) {
    if (!existsSync(resolve(ref.slice(1)))) {
      failures.push(`${file} references missing page: ${ref}`);
    }
  }
}

const pathAttrRegex = /(?:href|src)\s*=\s*"([^"#]+)"/g;
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  let match = pathAttrRegex.exec(content);
  while (match) {
    const pathValue = match[1].trim();
    const isAbsolutePath = pathValue.startsWith('/') && !pathValue.startsWith('/@');
    const shouldValidatePath = isAbsolutePath && pathValue.includes('.');
    if (shouldValidatePath && !fileExistsFromWebPath(pathValue)) {
      failures.push(`${file} contains broken internal path: ${pathValue}`);
    }
    match = pathAttrRegex.exec(content);
  }
}

if (failures.length > 0) {
  console.error('PR smoke checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('PR smoke checks passed.');

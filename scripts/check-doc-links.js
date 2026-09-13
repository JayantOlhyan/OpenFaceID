import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

function getMarkdownFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        files = files.concat(getMarkdownFiles(fullPath));
      }
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

const mdFiles = getMarkdownFiles(ROOT_DIR);
console.log(`Auditing links across ${mdFiles.length} markdown documents...`);

const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
let brokenLinks = 0;
let checkedLinks = 0;

for (const file of mdFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkTarget = match[2].trim();

    // Skip external URLs, mailto, anchors, and non-relative links
    if (
      linkTarget.startsWith('http://') ||
      linkTarget.startsWith('https://') ||
      linkTarget.startsWith('mailto:') ||
      linkTarget.startsWith('#') ||
      linkTarget.startsWith('file://')
    ) {
      continue;
    }

    checkedLinks++;
    // Remove anchor if present
    const targetFile = linkTarget.split('#')[0];
    if (!targetFile) continue;

    const resolved = path.resolve(path.dirname(file), targetFile);
    if (!fs.existsSync(resolved)) {
      console.error(`[BROKEN LINK] in ${path.relative(ROOT_DIR, file)}:`);
      console.error(`  Text: "${linkText}" -> Target: "${linkTarget}" (Resolved: ${path.relative(ROOT_DIR, resolved)})`);
      brokenLinks++;
    }
  }
}

console.log(`\nDoc Link Audit Complete:`);
console.log(`  Total relative links checked: ${checkedLinks}`);
console.log(`  Broken links found: ${brokenLinks}`);

if (brokenLinks > 0) {
  process.exit(1);
} else {
  console.log(`  Status: ALL DOCUMENTATION LINKS VALID!`);
}

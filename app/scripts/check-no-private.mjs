// Fails if private source material (College Board PDFs/ZIPs, teaching archive files) is inside the project.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const banned = [/\.pdf$/i, /\.zip$/i, /\.pptx$/i, /\.docx$/i, /\.xlsx$/i, /sat-practice-test/i, /scoring-sat-practice/i];
const skip = new Set(['node_modules', '.git', 'target', 'dist', 'dist-desktop']);
const hits = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    if (skip.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (banned.some((re) => re.test(f))) hits.push(p);
  }
})('.');
if (hits.length) { console.error('Private material must not be in the repository:\n' + hits.join('\n')); process.exit(1); }
console.log('No private source files found.');

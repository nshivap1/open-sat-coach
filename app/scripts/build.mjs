// Builds the app with esbuild.
//   node scripts/build.mjs            -> dist/index.html (single self-contained file: open it in a browser)
//   node scripts/build.mjs --desktop  -> dist-desktop/{index.html,app.js,app.css} (Tauri frontend, strict CSP, no inline script)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const desktop = process.argv.includes('--desktop');
const out = desktop ? 'dist-desktop' : 'dist';
if (desktop) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  outfile: `${out}/app.js`,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  logLevel: 'warning',
});

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open SAT Coach</title>`;

if (desktop) {
  writeFileSync(`${out}/index.html`, `<!doctype html>
<html lang="en">
<head>
${head}
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>`);
  console.log(`${out}/ ready (desktop frontend)`);
} else {
  const js = readFileSync(`${out}/app.js`, 'utf8').replace(/<\/script/gi, '<\\/script');
  let css = '';
  try { css = readFileSync(`${out}/app.css`, 'utf8'); } catch {}
  const html = `<!doctype html>
<html lang="en">
<head>
${head}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
  writeFileSync(`${out}/index.html`, html);
  console.log(`${out}/index.html ${(html.length / 1024).toFixed(0)} KB`);
}

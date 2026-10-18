// Bundles the app with esbuild and inlines JS + CSS into one self-contained dist/index.html.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  outfile: 'dist/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  logLevel: 'warning',
});
const js = readFileSync('dist/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
let css = '';
try { css = readFileSync('dist/app.css', 'utf8'); } catch {}
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open SAT Coach</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
writeFileSync('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);

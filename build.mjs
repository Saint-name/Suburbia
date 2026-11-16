// Bundles the game into a single self-contained dist/index.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/ui/app.js'], bundle: true, format: 'iife', minify: true, write: false,
  target: ['es2020', 'chrome90', 'safari14'], legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/ui/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);

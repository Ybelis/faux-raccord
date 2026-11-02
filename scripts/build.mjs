import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEvaluation } from './evaluation-data.mjs';
const root = process.cwd();
await viteBuild({ root, build: { outDir: 'dist/client', emptyOutDir: true, sourcemap: false } });
let recorded = {};
const evaluation = await loadEvaluation();
try {
  recorded = JSON.parse(await readFile('data/recorded.json', 'utf8'));
} catch {}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const assets = {};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else
      assets['/' + path.relative('dist/client', file).replaceAll('\\', '/')] = {
        type: mime[path.extname(file)] || 'application/octet-stream',
        base64: (await readFile(file)).toString('base64'),
      };
  }
}
await walk('dist/client');
await mkdir('.local', { recursive: true });
const entry = `import {api,setRecorded,setEvaluation} from '../worker/api.js';
setRecorded(${JSON.stringify(recorded)});setEvaluation(${JSON.stringify(evaluation)});
const assets=${JSON.stringify(assets)};
export default { async fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return api(request,env);const asset=assets[path]||(!path.includes('.')?assets['/index.html']:null);if(!asset)return new Response('Introuvable',{status:404});const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':asset.type,'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'"}})}};`;
await writeFile('.local/worker-entry.mjs', entry);
await mkdir('dist/server', { recursive: true });
await bundle({
  absWorkingDir: root,
  entryPoints: [path.resolve('.local/worker-entry.mjs')],
  outfile: path.resolve('dist/server/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  conditions: ['workerd', 'browser'],
  external: ['node:*'],
  logLevel: 'warning',
});
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Built: React interface + self-contained Worker. No secret is embedded.');

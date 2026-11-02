import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { api, setRecorded, setEvaluation } from '../worker/api.js';
import { loadEvaluation } from './evaluation-data.mjs';
const port = Number(process.env.PORT || 4173);
try {
  setRecorded(
    JSON.parse(await readFile(new URL('../data/recorded.json', import.meta.url), 'utf8')),
  );
} catch {
  // Sans analyses enregistrées, l'import et une nouvelle analyse restent disponibles.
}
setEvaluation(await loadEvaluation());
const production = process.argv.includes('--production');
const { createServer } = production ? {} : await import('vite');
const vite = production
  ? null
  : await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'spa' });
const packaged = production ? (await import('../dist/server/index.js')).default : null;
const server = http.createServer(async (req, res) => {
  if (!production && !req.url.startsWith('/api/')) return vite.middlewares(req, res);
  const controller = new AbortController();
  req.once('aborted', () => controller.abort());
  res.once('close', () => {
    // Le navigateur peut partir après l'envoi complet du POST. Dans ce cas,
    // seule la fermeture de la réponse permet d'arrêter l'appel fournisseur.
    // Une réponse terminée normalement ne doit pas être marquée annulée.
    if (!res.writableEnded) controller.abort();
  });
  try {
    if (req.url.startsWith('/api/evaluation')) {
      try {
        setEvaluation(await loadEvaluation());
      } catch {}
    }
    if (req.url.startsWith('/api/samples/')) {
      try {
        setRecorded(
          JSON.parse(await readFile(new URL('../data/recorded.json', import.meta.url), 'utf8')),
        );
      } catch {}
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 6 * 1024 * 1024) {
        res.writeHead(413).end('Fichier trop volumineux');
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
      signal: controller.signal,
    });
    const response = packaged
      ? await packaged.fetch(request, { ...process.env, LOCAL_MODE: true }, {})
      : await api(request, { ...process.env, LOCAL_MODE: true });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body)
      for await (const chunk of response.body) {
        if (res.destroyed) {
          controller.abort();
          break;
        }
        res.write(chunk);
      }
    res.end();
  } catch (error) {
    if (res.destroyed) return;
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur du serveur local.' }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Faux Raccord — http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    await vite?.close();
    server.close(() => process.exit(0));
  });

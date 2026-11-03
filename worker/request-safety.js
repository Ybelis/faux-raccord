export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Compter les octets réellement reçus protège aussi les requêtes sans
// Content-Length, contrairement à un contrôle du seul en-tête déclaré.
export async function readJsonRequest(request, maxBytes = 1_400_000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new RequestError('La requête doit utiliser le format application/json.', 415);
  if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new RequestError('Requête trop volumineuse.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Requête JSON invalide.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '',
    bytes = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new RequestError('Requête interrompue.');
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new RequestError('Requête trop volumineuse.', 413);
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Requête JSON invalide.');
  } finally {
    await reader.cancel().catch(() => {});
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new RequestError('Requête JSON invalide.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError('La requête doit contenir un objet JSON.');
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop();
    if (++count > 50_000 || entry.depth > 24)
      throw new RequestError('Structure JSON trop complexe.');
    if (!entry.value || typeof entry.value !== 'object') continue;
    for (const [key, child] of Object.entries(entry.value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new RequestError('Structure JSON non autorisée.');
      pending.push({ value: child, depth: entry.depth + 1 });
    }
  }
  return value;
}

export function checkRequestOrigin(request) {
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      origin &&
      origin !== new URL(request.url).origin)
  )
    throw new RequestError('Origine de requête non autorisée.', 403);
}

// Un hôte extérieur résolvant vers 127.0.0.1 ne doit pas donner accès à
// l'application locale. localhost et l'adresse affichée restent utilisables.
export function localRequestUrl(target, host, port) {
  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!allowed.has(String(host || '').toLowerCase()))
    throw new RequestError('Hôte local non autorisé.', 403);
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(target)
  )
    throw new RequestError('Adresse de requête invalide.');
  const base = `http://${String(host).toLowerCase()}`;
  const url = new URL(target, base);
  if (url.origin !== base) throw new RequestError('Adresse de requête invalide.');
  return url;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../worker/api.js';
import { localRequestUrl, readJsonRequest } from '../worker/request-safety.js';

const scene = {
  id: 'S001',
  text: 'Alice regarde sa montre argentée posée sur la table.',
  pages: [1],
};
const post = (path, body, headers = {}) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('malformed scene references are rejected without internal errors or duplicate citation IDs', async () => {
  for (const scenes of [
    [null],
    [{ id: 'S001', text: scene.text }],
    [scene, scene],
    [{ ...scene, pages: ['1'] }],
    [{ ...scene, heading: { html: '<script>' } }],
    [{ ...scene, pageSegments: [{ page: 1, text: null }] }],
  ]) {
    const response = await api(post('/api/search', { scenes, query: 'montre' }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'Format des scènes invalide.');
    assert.doesNotMatch(body.error, /Cannot|undefined|TypeError|\.js:/);
  }
  const valid = await api(post('/api/search', { scenes: [scene], query: 'montre' }));
  assert.equal(valid.status, 200);
});

test('JSON request limits count streamed UTF-8 bytes without trusting Content-Length', async () => {
  let cancelled = false;
  const bytes = new TextEncoder().encode(JSON.stringify({ padding: 'é'.repeat(40) }));
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    duplex: 'half',
  });
  await assert.rejects(readJsonRequest(request, 64), (error) => error.status === 413);
  assert.equal(cancelled, true);
  const oversized = await api(
    post('/api/search', {
      scenes: [scene],
      query: 'montre',
      padding: 'é'.repeat(700_000),
    }),
  );
  assert.equal(oversized.status, 413);
});

test('non-JSON, deeply nested and reserved-key requests cannot reach the model', async () => {
  assert.equal(
    (await api(post('/api/analyze', '{}', { 'Content-Type': 'text/plain' }))).status,
    415,
  );
  for (const raw of [
    '{"scenes":[],"__proto__":{"polluted":true}}',
    '{"padding":' + '['.repeat(26) + '0' + ']'.repeat(26) + '}',
    '{broken',
  ]) {
    assert.equal((await api(post('/api/analyze', raw))).status, 400);
  }
  assert.equal({}.polluted, undefined);
});

test('foreign browser requests and inherited sample keys are rejected', async () => {
  const foreign = await api(
    new Request('http://localhost/api/status', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    }),
  );
  assert.equal(foreign.status, 403);
  assert.equal(
    (await api(post('/api/search', {}, { Origin: 'http://attacker.example' }))).status,
    403,
  );
  for (const key of ['__proto__', 'constructor', 'toString'])
    assert.equal((await api(new Request(`http://localhost/api/samples/${key}`))).status, 404);
});

test('local host validation preserves localhost origins and refuses rebinding hosts and absolute targets', () => {
  assert.equal(
    localRequestUrl('/api/import', 'localhost:4173', 4173).origin,
    'http://localhost:4173',
  );
  assert.equal(localRequestUrl('/api/status', '127.0.0.1:4173', 4173).host, '127.0.0.1:4173');
  for (const host of [
    'attacker.example:4173',
    '127.0.0.1.attacker.example:4173',
    'localhost:9999',
    '',
  ])
    assert.throws(() => localRequestUrl('/api/status', host, 4173), /Hôte local/);
  for (const target of [
    'http://attacker.example/api/status',
    '//attacker.example/a',
    '/\\attacker.example/a',
  ])
    assert.throws(() => localRequestUrl(target, 'localhost:4173', 4173), /Adresse/);
});

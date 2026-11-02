import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { api } from '../worker/api.js';
const request = (path, body) =>
  new Request(
    'http://localhost' + path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  );
test('the sample API returns the real 56-scene corpus and accurate license metadata', async () => {
  const r = await api(request('/api/samples/valkaama'));
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.scenes.length, 56);
  assert.equal(data.synthetic, false);
  assert.equal(data.license, 'CC BY-SA 3.0');
});
test('the controlled adaptation is identified and never includes the answer key', async () => {
  const response = await api(request('/api/samples/controlled-valkaama'));
  const project = await response.json();
  assert.equal(project.controlled, true);
  assert.equal(project.controlledInjectionCount, 15);
  assert.equal(project.scenes.length, 56);
  assert.equal(project.license, 'CC BY-SA 3.0');
  assert.equal(project.annotations, undefined);
  assert.equal(project.entries, undefined);
  assert.ok(project.scenes[0].text.includes('brass pocket watch'));
  const samples = await (await api(request('/api/samples'))).json();
  assert.equal(samples.find((sample) => sample.id === project.id).controlled, true);
});
test('a genuine source PDF is parsed into screenplay scenes', async () => {
  const bytes = await readFile(new URL('../data/raw/valkaama-en.pdf', import.meta.url));
  const form = new FormData();
  form.append('file', new File([bytes], 'valkaama.pdf', { type: 'application/pdf' }));
  const r = await api(new Request('http://localhost/api/import', { method: 'POST', body: form }));
  const data = await r.json();
  assert.equal(r.status, 200, data.error);
  assert.equal(data.scenes.length, 56);
  assert.ok(data.scenes[0].text.includes('RUNA'));
});
test('status exposes availability but never provider secrets', async () => {
  const r = await api(request('/api/status'), { GROQ_API_KEY: 'test-secret' });
  const text = await r.text();
  assert.ok(!text.includes('test-secret'));
  assert.equal(JSON.parse(text).groq, true);
});
test('unsupported imports and malformed JSON are rejected', async () => {
  const form = new FormData();
  form.append('file', new File(['not a screenplay'], 'evil.exe'));
  assert.equal(
    (await api(new Request('http://localhost/api/import', { method: 'POST', body: form }))).status,
    400,
  );
  assert.equal(
    (await api(new Request('http://localhost/api/analyze', { method: 'POST', body: '{broken' })))
      .status,
    400,
  );
});
test('analysis requires explicit consent and valid scene IDs', async () => {
  const scenes = [
    {
      id: 'S001',
      text: 'Une scène suffisamment longue dans laquelle une montre est posée sur la table.',
      pages: [1],
    },
  ];
  assert.equal(
    (await api(request('/api/analyze', { scenes, consent: false }), { GROQ_API_KEY: 'test' }))
      .status,
    400,
  );
  assert.equal(
    (
      await api(
        request('/api/analyze', { scenes: [{ ...scenes[0], id: '../.env' }], consent: true }),
        { GROQ_API_KEY: 'test' },
      )
    ).status,
    400,
  );
});

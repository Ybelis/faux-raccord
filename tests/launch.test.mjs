import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configuredPort, isOwnServer, rootId } from '../scripts/launch.mjs';

test('launcher reads the configured port without overriding an explicit environment', () => {
  assert.equal(configuredPort({}, {}), 4173);
  assert.equal(configuredPort({}, { PORT: '4812' }), 4812);
  assert.equal(configuredPort({ PORT: '4900' }, { PORT: '4812' }), 4900);
  for (const port of ['0', '65536', '-1', '41.73', '3000;other'])
    assert.throws(() => configuredPort({ PORT: port }), /PORT/);
});

test('restart ownership requires this checkout and a valid process, not an application name alone', () => {
  const own = { app: 'faux-raccord', rootId, pid: 12345, port: 4173 };
  assert.equal(isOwnServer(own, 4173), true);
  assert.equal(isOwnServer({ ...own, rootId: 'another-checkout' }, 4173), false);
  assert.equal(isOwnServer({ ...own, pid: -1 }, 4173), false);
  assert.equal(isOwnServer(own, 4180), false);
  assert.equal(isOwnServer({ app: 'faux-raccord' }, 4173), false);
});

test('launcher diagnostic works from another working directory and never prints credentials', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../scripts/launch.mjs', import.meta.url)), '--check'],
    { cwd: tmpdir(), encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
  const diagnostic = JSON.parse(result.stdout);
  assert.equal(diagnostic.url.startsWith('http://127.0.0.1:'), true);
  assert.deepEqual(diagnostic.missingDependencies, []);
  assert.equal(result.stdout.includes('GROQ_API_KEY'), false);
  assert.equal(result.stdout.includes('gsk_'), false);
});

test('restart refuses an occupied port and leaves the unrelated server running', async (t) => {
  const other = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ app: 'another-application' }));
  });
  other.listen(0, '127.0.0.1');
  await once(other, 'listening');
  t.after(() => other.close());
  const port = other.address().port;
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../scripts/launch.mjs', import.meta.url)), '--restart'],
    { cwd: tmpdir(), env: { ...process.env, PORT: String(port) }, windowsHide: true },
  );
  let output = '';
  child.stderr.on('data', (chunk) => (output += chunk));
  const [exitCode] = await once(child, 'close');
  assert.equal(exitCode, 1, output);
  assert.match(output, /Aucun processus n’a été arrêté/);
  const response = await fetch(`http://127.0.0.1:${port}`);
  assert.equal((await response.json()).app, 'another-application');
});

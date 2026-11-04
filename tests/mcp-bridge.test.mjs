import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bridge = fileURLToPath(new URL('../agent/search_bridge.mjs', import.meta.url));
const source = new URL('../data/controlled-script/project.json', import.meta.url);
const sourceHash = () => createHash('sha256').update(readFileSync(source)).digest('hex');
const revision = sourceHash();

function callBridge(input, { sample = 'controlled-valkaama', expectedRevision = revision } = {}) {
  // Exercise stdin as bytes: UTF-8 and size checks must happen before JSON parsing.
  const child = spawnSync(
    process.execPath,
    [bridge, '--sample', sample, '--revision', expectedRevision],
    {
      cwd: root,
      input,
      encoding: 'utf8',
      shell: false,
      timeout: 15_000,
      maxBuffer: 128 * 1024,
    },
  );
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  assert.equal(child.stderr, '');
  return { status: child.status, data: JSON.parse(child.stdout) };
}

function assertError(result, code) {
  assert.equal(result.status, 1);
  assert.equal(result.data.error.code, code);
  assert.ok(result.data.error.message.trim());
  assert.equal(result.data.passages, undefined);
  assert.ok(!result.data.error.message.includes(root));
  assert.ok(!result.data.error.message.includes('Traceback'));
}

test('the MCP search bridge rejects malformed JSON on stdin', () => {
  assertError(callBridge('{"query":'), 'INVALID_ARGUMENTS');
});

test('the MCP search bridge enforces the 16 KiB input budget', () => {
  const oversized = Buffer.alloc(16 * 1024 + 1, ' ');
  const result = callBridge(oversized);
  assertError(result, 'INVALID_ARGUMENTS');
  assert.match(result.data.error.message, /16 KiB/);
});

test('the MCP search bridge rejects invalid UTF-8 instead of replacing bytes', () => {
  const malformed = Buffer.concat([
    Buffer.from('{"query":"'),
    Buffer.from([0xff]),
    Buffer.from('"}'),
  ]);
  assertError(callBridge(malformed), 'INVALID_ARGUMENTS');
});

test('a stale MCP source revision is rejected without changing the corpus', () => {
  const before = sourceHash();
  const result = callBridge('{"query":"watch"}', { expectedRevision: '0'.repeat(64) });
  assertError(result, 'STALE_REVISION');
  assert.equal(sourceHash(), before);
});

test('the MCP search bridge only accepts allowlisted corpus names', () => {
  for (const sample of ['unknown-script', '../../.env', 'https://example.org/script.json']) {
    assertError(callBridge('{"query":"watch"}', { sample }), 'INVALID_CONTEXT');
  }
});

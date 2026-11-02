import test from 'node:test';
import assert from 'node:assert/strict';
import { readDocumentAsset } from '../scripts/document-assets.mjs';

test('document exports use a closed allowlist, including against traversal and object keys', async () => {
  const document = await readDocumentAsset('/docs/system_card.md');
  assert.equal(document.type, 'text/markdown; charset=utf-8');
  assert.ok(document.bytes.length > 100);
  for (const pathname of [
    '/docs/../.env',
    '/docs/../../.env',
    '/docs/%2e%2e/.env',
    '/docs/toString',
    '__proto__',
    '/docs/missing.md',
  ]) {
    assert.equal(await readDocumentAsset(pathname), null);
  }
});

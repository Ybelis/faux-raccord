import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  importDocument,
  extractPDFInWorker,
  IMPORT_LIMITS,
  ImportError,
} from '../worker/imports.js';

const screenplay =
  '1. INT. ATELIER - JOUR\nALICE pose sa montre argentée sur la table.\n2. EXT. COUR - JOUR\nAlice tient la même montre dans sa main.';
const upload = (body, filename = 'scenario.txt', type = 'text/plain', extra) => {
  const form = new FormData();
  form.append('file', new File([body], filename, { type }));
  extra?.(form);
  return new Request('http://localhost/api/import', { method: 'POST', body: form });
};
const rejectsImport = (request, pattern, status) =>
  assert.rejects(importDocument(request), (error) => {
    assert.match(error.message, pattern);
    if (status) assert.equal(error.status, status);
    return true;
  });

// A tiny genuine PDF exercises decompression/page limits without keeping hostile
// files in the repository or allocating an actual out-of-memory payload.
function pdfFixture({ text = screenplay, pages = 1, javascript = false } = {}) {
  const contentIndex = pages + 3;
  const fontIndex = pages + 4;
  const escaped = text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('\n', ' ');
  const stream = deflateSync(Buffer.from(`BT /F1 0.001 Tf 10 700 Td (${escaped}) Tj ET`, 'utf8'));
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${javascript ? '/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>' : ''} >>`,
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ')}] /Count ${pages} >>`,
    ...Array.from(
      { length: pages },
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontIndex} 0 R >> >> /Contents ${contentIndex} 0 R >>`,
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
      stream,
      Buffer.from('\nendstream'),
    ]),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let position = parts[0].length;
  for (const [i, object] of objects.entries()) {
    offsets.push(position);
    const bytes = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.from(object),
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(bytes);
    position += bytes.length;
  }
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join(
      '',
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  return Buffer.concat([...parts, Buffer.from(xref)]);
}

test('plain UTF-8 and a genuine screenplay PDF retain scenes under the hardened import', async () => {
  const plain = await importDocument(upload(screenplay, 'Scénario-original.fountain'));
  assert.equal(plain.scenes.length, 2);
  assert.equal(plain.analysis, null);
  const bytes = await readFile(new URL('../data/raw/valkaama-en.pdf', import.meta.url));
  const pdf = await importDocument(upload(bytes, 'valkaama.pdf', 'application/pdf'));
  assert.equal(pdf.scenes.length, 56);
  assert.ok(pdf.scenes[0].text.includes('Runa'));
});

test('extension, MIME, signature, encoding and binary contents must agree', async () => {
  await rejectsImport(upload(screenplay, 'script.exe'), /Formats acceptés/);
  await rejectsImport(upload('MZ\u0000binary', 'script.pdf', 'application/pdf'), /contenu.*PDF/);
  await rejectsImport(upload(screenplay, 'script.txt', 'text/html'), /type.*format/);
  await rejectsImport(upload(new Uint8Array([0xff, 0xfe, 0x61, 0x00]), 'script.txt'), /UTF-8/);
  await rejectsImport(
    upload('1. INT. ATELIER - JOUR\ntexte\u0000binaire', 'script.txt'),
    /binaires/,
  );
  await rejectsImport(
    upload('<!doctype html><html><script>alert(1)</script></html>', 'script.txt'),
    /HTML/,
  );
  await rejectsImport(upload('<script>alert(1)</script>', 'script.md'), /HTML/);
  // A dialogue may legitimately discuss code. It is imported as ordinary text.
  const harmless = await importDocument(
    upload(screenplay + '\nALICE\nLe mot <script> apparaît dans son livre.'),
  );
  assert.ok(harmless.scenes[1].text.includes('<script>'));
});

test('empty uploads, misleading names and oversized files are rejected before parsing', async () => {
  await rejectsImport(upload(''), /vide/);
  await rejectsImport(upload(screenplay, 'a'.repeat(181) + '.txt'), /Nom de fichier/);
  await rejectsImport(upload(screenplay, 'scenario\u202e.txt'), /Nom de fichier/);
  await rejectsImport(upload(new Uint8Array(IMPORT_LIMITS.fileBytes + 1)), /5 Mo/, 413);
});

test('insufficient text and PDFs without text return an actionable input error', async () => {
  for (const request of [
    upload('Texte trop court.'),
    upload(pdfFixture({ text: '' }), 'sans-texte.pdf', 'application/pdf'),
  ]) {
    await assert.rejects(importDocument(request), (error) => {
      assert.ok(error instanceof ImportError);
      assert.equal(error.status, 400);
      assert.match(error.message, /texte exploitable.*texte sélectionnable/);
      return true;
    });
  }
});

test('only one multipart file and no unexpected fields are accepted', async () => {
  await rejectsImport(
    upload(screenplay, 'a.txt', 'text/plain', (form) =>
      form.append('file', new File([screenplay], 'b.txt')),
    ),
    /seul fichier/,
  );
  await rejectsImport(
    upload(screenplay, 'a.txt', 'text/plain', (form) =>
      form.append('url', 'http://127.0.0.1/private'),
    ),
    /seul fichier/,
  );
  await rejectsImport(
    new Request('http://localhost/api/import', { method: 'POST', body: screenplay }),
    /formulaire/,
  );
  await rejectsImport(
    new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=broken' },
      body: 'not a multipart body',
    }),
    /formulaire.*invalide/,
  );
});

test('actual body bytes are bounded and the stream is cancelled without Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(IMPORT_LIMITS.requestBytes + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('http://localhost/api/import', {
    method: 'POST',
    duplex: 'half',
    headers: { 'Content-Type': 'multipart/form-data; boundary=unused' },
    body: stream,
  });
  await rejectsImport(request, /5 Mo/, 413);
  assert.equal(cancelled, true);
});

test('text character, scene count and per-scene budgets reject unusable projects', async () => {
  await rejectsImport(upload('x'.repeat(180001)), /180 000/, 413);
  await rejectsImport(
    upload(
      Array.from(
        { length: 201 },
        (_, i) => `${i + 1}. INT. ATELIER - JOUR\nAlice regarde la montre.`,
      ).join('\n'),
    ),
    /200 scènes/,
    413,
  );
  await rejectsImport(upload('1. INT. ATELIER - JOUR\n' + 'a'.repeat(14000)), /14 000/, 413);
});

test('small compressed PDFs cannot exceed expanded text or page budgets', async () => {
  const expanded = pdfFixture({ text: 'A'.repeat(180001) });
  assert.ok(expanded.length < 5000);
  await rejectsImport(upload(expanded, 'large-text.pdf', 'application/pdf'), /180 000/, 413);
  const manyPages = pdfFixture({ pages: 161 });
  await rejectsImport(upload(manyPages, 'many-pages.pdf', 'application/pdf'), /160 pages/, 413);
});

test('active PDF scripts and malformed PDF parser errors are rejected without leaking internals', async () => {
  await rejectsImport(
    upload(pdfFixture({ javascript: true }), 'active.pdf', 'application/pdf'),
    /scripts/,
  );
  await rejectsImport(
    upload('%PDF-1.4\ninternal-secrets-should-not-appear', 'broken.pdf', 'application/pdf'),
    /PDF illisible/,
  );
  await assert.rejects(
    importDocument(upload('%PDF-1.4\nprivate-marker', 'broken.pdf', 'application/pdf')),
    (error) => !error.message.includes('private-marker'),
  );
});

test('PDF deadlines, cancellation and concurrency limits terminate work instead of queueing indefinitely', async () => {
  const bytes = pdfFixture();
  await assert.rejects(
    extractPDFInWorker(bytes, { timeoutMs: 1 }),
    (error) => error.status === 408,
  );
  const controller = new AbortController();
  const cancelled = extractPDFInWorker(bytes, { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, (error) => error.status === 408);
  const jobs = [
    extractPDFInWorker(bytes, { timeoutMs: 30 }),
    extractPDFInWorker(bytes, { timeoutMs: 30 }),
  ];
  try {
    await assert.rejects(extractPDFInWorker(bytes), (error) => error.status === 429);
  } finally {
    await Promise.allSettled(jobs);
  }
  // Slots are released even after failure and cancellation.
  const next = await extractPDFInWorker(bytes);
  assert.equal(next.pages.length, 1);
});

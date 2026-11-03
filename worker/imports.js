import { parseScreenplay, MAX_CHARS } from '../src/core/parser.js';

export const IMPORT_LIMITS = Object.freeze({
  requestBytes: 6 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  textCharacters: MAX_CHARS,
  pdfPages: 160,
  scenes: 200,
  sceneCharacters: 14_000,
  pdfTimeoutMs: 20_000,
  concurrentPDFs: 2,
});

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const tooLarge = () => new ImportError('Le fichier dépasse la limite de 5 Mo.', 413);
let activePDFs = 0;

/** Content-Length is only a hint: count bytes as they arrive, then stop reading. */
export async function readImportBody(request) {
  const declared = request.headers.get('content-length');
  if (declared != null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared))))
    throw new ImportError('Taille de requête invalide.');
  if (Number(declared || 0) > IMPORT_LIMITS.requestBytes) {
    await request.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ImportError('Le fichier à importer est manquant.');
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new ImportError('Import interrompu.', 408);
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > IMPORT_LIMITS.requestBytes) throw tooLarge();
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function filenameParts(file) {
  const filename = String(file.name || '').normalize('NFC');
  // The name is display metadata, never a path. Reject paths, controls and bidi
  // overrides rather than silently turning a hostile name into a trusted label.
  if (
    filename.length > 180 ||
    filename !== filename.trim() ||
    /[\\/:<>"|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(filename)
  )
    throw new ImportError('Nom de fichier invalide. Renommez le document avant de l’importer.');
  const match = filename.match(/^(.+)\.(pdf|txt|fountain|md)$/i);
  if (!match || !match[1].trim() || match[1].startsWith('.'))
    throw new ImportError('Formats acceptés : PDF avec texte, TXT, Fountain et Markdown.');
  const ext = match[2].toLowerCase();
  const mime = String(file.type || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  const allowed =
    ext === 'pdf'
      ? ['', 'application/pdf', 'application/octet-stream']
      : ext === 'md'
        ? ['', 'text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream']
        : ext === 'fountain'
          ? [
              '',
              'text/plain',
              'text/x-fountain',
              'application/x-fountain',
              'application/octet-stream',
            ]
          : ['', 'text/plain', 'application/octet-stream'];
  if (!allowed.includes(mime))
    throw new ImportError('Le type du fichier ne correspond pas au format annoncé.');
  return { filename, ext, title: match[1].replace(/[_-]/g, ' ').trim().slice(0, 160) };
}

function decodeText(bytes) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ImportError('Le document texte doit être encodé en UTF-8.');
  }
  if (text.length > IMPORT_LIMITS.textCharacters)
    throw new ImportError('Le texte dépasse 180 000 caractères. Importez un extrait.', 413);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))
    throw new ImportError('Le fichier contient des données binaires au lieu d’un scénario texte.');
  // These are document formats, not code or web uploads. Never render HTML or
  // interpret XML, scripts, SVG, ZIP or executables under a text extension.
  if (
    /^(?:\s*<\?xml|\s*<!doctype\s+html|\s*<html\b|\s*<svg\b|\s*%PDF-|MZ|PK\u0003\u0004)/i.test(
      text,
    ) ||
    /^\s*<(?:script|iframe|object|embed)\b/i.test(text)
  )
    throw new ImportError(
      'Importez le texte du scénario, sans document HTML, script ou fichier binaire.',
    );
  return text;
}

/**
 * PDF.js parses inside a disposable Node thread: a busy parser cannot block the
 * HTTP event loop, and a deadline or cancellation terminates the computation.
 * V8 heap limits are not an OS sandbox and do not cap all native/ArrayBuffer use.
 */
export async function extractPDFInWorker(
  bytes,
  { signal, timeoutMs = IMPORT_LIMITS.pdfTimeoutMs } = {},
) {
  if (signal?.aborted) throw new ImportError('Import interrompu.', 408);
  if (activePDFs >= IMPORT_LIMITS.concurrentPDFs)
    throw new ImportError(
      'Deux PDF sont déjà en cours de lecture. Réessayez dans un instant.',
      429,
    );
  activePDFs++;
  let worker;
  try {
    const { Worker } = await import('node:worker_threads');
    if (signal?.aborted) throw new ImportError('Import interrompu.', 408);
    worker = new Worker(new URL('./pdf-extract-worker.mjs', import.meta.url), {
      workerData: {
        bytes,
        maxCharacters: IMPORT_LIMITS.textCharacters,
        maxPages: IMPORT_LIMITS.pdfPages,
      },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
      env: {},
      execArgv: [],
    });
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(result);
      };
      const abort = () => finish(new ImportError('Import interrompu.', 408));
      const timer = setTimeout(
        () => finish(new ImportError('La lecture du PDF a dépassé le délai autorisé.', 408)),
        Math.max(1, Math.min(IMPORT_LIMITS.pdfTimeoutMs, timeoutMs)),
      );
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      worker.once('message', (message) => {
        if (message?.ok && Array.isArray(message.pages)) finish(null, { pages: message.pages });
        else if (message?.code === 'PAGE_LIMIT')
          finish(new ImportError('PDF trop long : 160 pages maximum.', 413));
        else if (message?.code === 'TEXT_LIMIT')
          finish(
            new ImportError(
              'Le texte extrait dépasse 180 000 caractères. Importez un extrait.',
              413,
            ),
          );
        else if (message?.code === 'ACTIVE_CONTENT')
          finish(
            new ImportError('Le PDF contient des scripts. Exportez une version texte simple.'),
          );
        else
          finish(
            new ImportError(
              'PDF illisible, protégé ou invalide. Importez un PDF avec du texte sélectionnable.',
            ),
          );
      });
      worker.once('error', (error) =>
        finish(
          error.code === 'ERR_WORKER_OUT_OF_MEMORY'
            ? new ImportError('Le PDF dépasse les ressources autorisées. Importez un extrait.', 413)
            : new ImportError(
                'La lecture du PDF a échoué. Importez un PDF avec du texte sélectionnable.',
              ),
        ),
      );
      worker.once('exit', () =>
        finish(new ImportError('La lecture du PDF a été interrompue.', 400)),
      );
    });
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('La lecture PDF est disponible dans la version locale Node.js.', 503);
  } finally {
    // Terminate even after success: parser internals cannot keep a thread alive.
    if (worker) await worker.terminate().catch(() => {});
    activePDFs--;
  }
}

export async function importDocument(request, { parsePDF = extractPDFInWorker } = {}) {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary\s*=/i.test(contentType))
    throw new ImportError('Envoyez un seul fichier avec le formulaire d’import.');
  const bytes = await readImportBody(request);
  let form;
  try {
    form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new ImportError('Le formulaire d’import est invalide.');
  }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== 'file')
    throw new ImportError('Importez un seul fichier à la fois, sans champ supplémentaire.');
  const file = entries[0][1];
  if (!file || typeof file.arrayBuffer !== 'function')
    throw new ImportError('Le fichier à importer est manquant.');
  if (!file.size) throw new ImportError('Le fichier à importer est vide.');
  if (file.size > IMPORT_LIMITS.fileBytes) throw tooLarge();
  const { filename, ext, title } = filenameParts(file);
  const content = new Uint8Array(await file.arrayBuffer());
  let input;
  if (ext === 'pdf') {
    const header = new TextDecoder('ascii').decode(content.subarray(0, 16));
    if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\s|$)/.test(header))
      throw new ImportError('Le contenu du fichier ne correspond pas à un PDF valide.');
    input = await parsePDF(content, { signal: request.signal });
  } else input = decodeText(content);
  let parsed;
  try {
    parsed = parseScreenplay(input);
  } catch (error) {
    if (/180 000/.test(error?.message || ''))
      throw new ImportError('Le texte dépasse 180 000 caractères. Importez un extrait.', 413);
    throw new ImportError(
      'Le document ne contient pas assez de texte exploitable. Importez un scénario texte ou un PDF avec du texte sélectionnable.',
    );
  }
  if (parsed.scenes.length > IMPORT_LIMITS.scenes)
    throw new ImportError('Le scénario dépasse 200 scènes. Importez un extrait.', 413);
  if (parsed.scenes.some((scene) => scene.text.length > IMPORT_LIMITS.sceneCharacters))
    throw new ImportError(
      'Une scène dépasse 14 000 caractères. Découpez le document en scènes plus courtes avant de l’importer.',
      413,
    );
  return {
    id: crypto.randomUUID(),
    title,
    author: 'Document importé',
    filename,
    license: 'À documenter',
    synthetic: false,
    ...parsed,
    analysis: null,
  };
}

import { parentPort, workerData } from 'node:worker_threads';

// No credentials or network are needed to extract uploaded bytes. The worker
// receives an empty environment, and a PDF cannot trigger external fetches.
globalThis.fetch = async () => {
  throw new Error('External fetch disabled in document import.');
};

let pdf;
try {
  const { getDocumentProxy } = await import('unpdf');
  pdf = await getDocumentProxy(workerData.bytes, {
    maxImageSize: 1_000_000,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true,
    enableXfa: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    stopAtErrors: true,
    verbosity: 0,
  });
  if (pdf.numPages > workerData.maxPages) throw new Error('PAGE_LIMIT');
  const actions = await pdf.getJSActions();
  // Attachments, links and images are never requested or rendered. In
  // particular, do not decode attachment bytes just to inspect their presence.
  if (actions && (actions.size || Object.keys(actions).length)) throw new Error('ACTIVE_CONTENT');
  const pages = [];
  let total = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    try {
      const actions = await page.getJSActions();
      if (actions && (actions.size || Object.keys(actions).length))
        throw new Error('ACTIVE_CONTENT');
      const content = await page.getTextContent();
      let text = '';
      let lastY = null;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = Math.round(item.transform?.[5] || 0);
        if (lastY !== null && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
        if (total + text.length + item.str.length + 3 > workerData.maxCharacters)
          throw new Error('TEXT_LIMIT');
        text += item.str + (item.hasEOL ? '\n' : ' ');
        lastY = y;
      }
      total += text.length + 2;
      if (total > workerData.maxCharacters) throw new Error('TEXT_LIMIT');
      pages.push({ page: i, text });
    } finally {
      page.cleanup();
    }
  }
  parentPort.postMessage({ ok: true, pages });
} catch (error) {
  // Never send parser exception messages, filenames, paths or document text.
  parentPort.postMessage({
    ok: false,
    code: ['PAGE_LIMIT', 'TEXT_LIMIT', 'ACTIVE_CONTENT'].includes(error?.message)
      ? error.message
      : 'INVALID_PDF',
  });
} finally {
  await pdf?.destroy().catch(() => {});
  parentPort.close();
}

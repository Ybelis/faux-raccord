import { readFile } from 'node:fs/promises';

// Liste fermée : aucune URL utilisateur n'est convertie en chemin de fichier.
export const documentAssets = {
  '/docs/evaluation_report.md': ['docs/evaluation_report.md', 'text/markdown; charset=utf-8'],
  '/docs/system_card.md': ['docs/system_card.md', 'text/markdown; charset=utf-8'],
  '/docs/use_policy.md': ['docs/use_policy.md', 'text/markdown; charset=utf-8'],
  '/docs/red_team_log.md': ['docs/red_team_log.md', 'text/markdown; charset=utf-8'],
  '/docs/print/evaluation.pdf': ['docs/print/evaluation.pdf', 'application/pdf'],
  '/docs/print/system-card.pdf': ['docs/print/system-card.pdf', 'application/pdf'],
};
export async function readDocumentAsset(pathname) {
  const entry = Object.hasOwn(documentAssets, pathname) && documentAssets[pathname];
  if (!entry) return null;
  try {
    return { bytes: await readFile(new URL('../' + entry[0], import.meta.url)), type: entry[1] };
  } catch {
    return null;
  }
}

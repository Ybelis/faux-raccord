import { guessCharacters, MAX_CHARS, fold } from '../src/core/parser.js';
import titleIndex from '../data/moviesum-index.json' with { type: 'json' };

// Only this public dataset can be queried. A client never supplies a remote URL.
export const MOVIESUM = Object.freeze({
  id: 'rohitsaxena/MovieSum',
  url: 'https://huggingface.co/datasets/rohitsaxena/MovieSum',
  paperUrl: 'https://aclanthology.org/2024.findings-acl.239/',
  attribution: 'Rohit Saxena et Frank Keller — MovieSum (ACL 2024)',
  declaredLicense: 'CC BY-NC 4.0',
  rightsNotice:
    'La licence annoncée concerne le jeu de données. Elle ne garantit pas les droits sur chaque scénario de film. Vérifiez votre usage avant une analyse externe ou une redistribution.',
});

const VIEWER_ORIGIN = 'https://datasets-server.huggingface.co';
const SPLITS = Object.freeze({ train: 1800, validation: 200, test: 200 });
const PAGE_SIZE = 6;
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;
const MAX_SCENES = 60;
const MAX_SCENE_CHARS = 13_500;
const CACHE_MS = 60_000;
const catalogCache = new Map();

class SourceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function checkSplit(value = 'train', allowAll = false) {
  if (allowAll && value === 'all') return value;
  if (!Object.hasOwn(SPLITS, value)) throw new SourceError('Partition MovieSum inconnue.');
  return value;
}

function checkIndex(value, max, label) {
  if (!['string', 'number'].includes(typeof value) || value === '')
    throw new SourceError(`${label} invalide.`);
  const integer = Number(value);
  if (!Number.isInteger(integer) || integer < 0 || integer >= max)
    throw new SourceError(`${label} invalide.`);
  return integer;
}

// Stop reading before a remote response can occupy unbounded worker memory.
async function readBounded(response, limit, isRequest = false) {
  const tooLarge = () =>
    new SourceError(
      isRequest
        ? 'La requête d’import est trop volumineuse.'
        : 'La réponse de la source dépasse la limite autorisée.',
      isRequest ? 413 : 502,
    );
  if (Number(response.headers.get('content-length') || 0) > limit) {
    await response.body?.cancel();
    throw tooLarge();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new SourceError('La source a renvoyé une réponse vide.', 502);
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw tooLarge();
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function requestRows({ split, offset, length = PAGE_SIZE, fetcher = fetch, signal }) {
  // L'index des titres est local ; seuls l'aperçu et l'import lisent une ligne
  // distante. La recherche ne dépend pas de l'index plein texte Hugging Face.
  const url = new URL('/rows', VIEWER_ORIGIN);
  for (const [key, value] of Object.entries({
    dataset: MOVIESUM.id,
    config: 'default',
    split,
    offset,
    length,
  }))
    url.searchParams.set(key, value);
  const timeout = AbortSignal.timeout(20_000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetcher(url, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: combinedSignal,
    });
  } catch {
    throw new SourceError(
      'MovieSum est momentanément inaccessible. Réessayez ou utilisez le scénario Valkaama disponible hors ligne.',
      502,
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new SourceError(
      response.status === 429
        ? 'La bibliothèque limite les requêtes. Patientez avant de réessayer.'
        : 'La bibliothèque MovieSum ne répond pas correctement. Les exemples locaux restent disponibles.',
      502,
    );
  }
  let data;
  try {
    data = JSON.parse(await readBounded(response, MAX_REMOTE_BYTES));
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError('La réponse MovieSum est incomplète ou illisible.', 502);
  }
  if (!Array.isArray(data.rows) || !Number.isInteger(data.num_rows_total))
    throw new SourceError('Le format de MovieSum a changé. Aucun scénario n’a été importé.', 502);
  return data;
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] || entity;
    const number =
      code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}

function plainXML(text) {
  return decodeEntities(
    text
      .replace(/<\/(?:stage_direction|scene_description|character|dialogue)>/gi, '\n\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function displayTitle(value) {
  return String(value || 'Scénario MovieSum')
    .replace(/_(\d{4})$/, ' ($1)')
    .slice(0, 180);
}

function catalogItem(entry, split) {
  const row = entry.row || {};
  const imdbId = /^tt\d{5,12}$/.test(row.imdb_id || '') ? row.imdb_id : null;
  return {
    source: 'moviesum',
    split,
    rowIndex: entry.row_idx,
    title: displayTitle(row.movie_name),
    imdbId,
    summary: String(row.summary || '').slice(0, 700),
    preview: plainXML(String(row.script || '').slice(0, 5000)).slice(0, 650),
    language: 'Anglais',
    truncatedBySource: (entry.truncated_cells || []).includes('script'),
  };
}

/** Recherche déterministe sur les titres et IMDb, jamais sur le texte du film. */
export function searchMovieSum(split, query, offset = 0) {
  const terms = fold(query).replace(/[_()]/g, ' ').split(/\s+/).filter(Boolean);
  const matching = titleIndex.items.filter((item) => {
    if (split !== 'all' && item.split !== split) return false;
    const searchable = fold(`${displayTitle(item.title)} ${item.imdbId}`);
    return terms.every((term) => searchable.includes(term));
  });
  return {
    source: MOVIESUM,
    split,
    query,
    offset,
    pageSize: PAGE_SIZE,
    total: matching.length,
    partial: false,
    searchFields: ['title', 'imdbId'],
    catalogMode: 'local-metadata-index',
    indexRevision: titleIndex.datasetRevision,
    indexGeneratedAt: titleIndex.generatedAt,
    items: matching.slice(offset, offset + PAGE_SIZE).map((item) => ({
      source: 'moviesum',
      split: item.split,
      rowIndex: item.rowIndex,
      title: displayTitle(item.title),
      imdbId: item.imdbId,
      language: 'Anglais',
      summary: '',
      preview: '',
      hasPreview: false,
    })),
  };
}

function verifyIndexedMovie(entry, split, rowIndex, requestedImdbId) {
  const indexed = titleIndex.items.find(
    (item) => item.split === split && item.rowIndex === rowIndex,
  );
  if (
    !indexed ||
    entry.row?.imdb_id !== indexed.imdbId ||
    (requestedImdbId !== undefined && requestedImdbId !== indexed.imdbId)
  ) {
    throw new SourceError(
      'Le catalogue source a changé. Actualisez l’index MovieSum avant d’importer ce film.',
      409,
    );
  }
}

async function readMovie(split, rowIndex, expectedImdbId, fetcher, signal) {
  if (expectedImdbId !== undefined && !/^tt\d{5,12}$/.test(expectedImdbId))
    throw new SourceError('Identifiant IMDb invalide.');
  const cacheKey = `${split}:${rowIndex}`;
  const cached = fetcher === fetch ? catalogCache.get(cacheKey) : null;
  if (cached && Date.now() - cached.created < CACHE_MS) {
    verifyIndexedMovie(cached.entry, split, rowIndex, expectedImdbId);
    return cached.entry;
  }
  const data = await requestRows({ split, offset: rowIndex, length: 1, fetcher, signal });
  const entry = data.rows.find((item) => item.row_idx === rowIndex);
  if (!entry) throw new SourceError('Ce scénario n’a pas été retrouvé dans MovieSum.', 404);
  verifyIndexedMovie(entry, split, rowIndex, expectedImdbId);
  // Une seule ligne en cache évite de conserver douze scénarios longs en mémoire.
  if (fetcher === fetch) {
    catalogCache.clear();
    catalogCache.set(cacheKey, { created: Date.now(), entry });
  }
  return entry;
}

function sceneParts(text) {
  const parts = [];
  let rest = text;
  while (rest.length > MAX_SCENE_CHARS) {
    // Split exceptionally long XML scenes on a line boundary. Subparts are explicit.
    const boundary = rest.lastIndexOf('\n', MAX_SCENE_CHARS);
    const cut = boundary > MAX_SCENE_CHARS / 2 ? boundary : MAX_SCENE_CHARS;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function movieSumProject(entry, split, now = new Date()) {
  const row = entry?.row;
  if (!row || typeof row.script !== 'string' || row.script.length < 30)
    throw new SourceError('Ce film ne contient pas de scénario exploitable.', 422);
  if ((entry.truncated_cells || []).includes('script'))
    throw new SourceError(
      'Hugging Face a tronqué ce scénario. Il n’est pas importé pour éviter de présenter un texte incomplet comme complet.',
      422,
    );
  if (/<!DOCTYPE|<!ENTITY/i.test(row.script))
    throw new SourceError('Structure XML non prise en charge.', 422);
  const sourceScenes = [...row.script.matchAll(/<scene(?:\s[^>]*)?>([\s\S]*?)<\/scene>/gi)];
  if (!sourceScenes.length)
    throw new SourceError('Aucune scène XML reconnue dans ce scénario MovieSum.', 422);

  const scenes = [];
  const warnings = [];
  let totalChars = 0;
  let splitScene = false;
  let excerpt = false;
  for (let index = 0; index < sourceScenes.length; index++) {
    const xml = sourceScenes[index][1];
    const text = plainXML(xml);
    if (text.length < 16) continue;
    const direction = xml.match(/<stage_direction(?:\s[^>]*)?>([\s\S]*?)<\/stage_direction>/i);
    const heading = direction
      ? plainXML(direction[1]).replace(/\s+/g, ' ').slice(0, 180)
      : `Scène XML ${index + 1}`;
    const parts = sceneParts(text);
    splitScene ||= parts.length > 1;
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      if (scenes.length >= MAX_SCENES || totalChars + part.length + 2 > MAX_CHARS - 100) {
        excerpt = true;
        break;
      }
      const sequence = scenes.length + 1;
      const time =
        heading.match(/\b(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS)\b/i)?.[1] ||
        'Non précisé';
      const number = parts.length > 1 ? `${index + 1}.${partIndex + 1}` : String(index + 1);
      scenes.push({
        id: `S${String(sequence).padStart(3, '0')}`,
        index: sequence - 1,
        number,
        heading:
          parts.length > 1 ? `${heading} — partie ${partIndex + 1}/${parts.length}` : heading,
        text: part,
        pages: [index + 1],
        pageSegments: [{ page: index + 1, text: part }],
        sourceSceneNumber: index + 1,
        sourceLocator: `Scène XML ${number}`,
        pageIsSceneReference: true,
        location: heading
          .replace(/^(INT\.?|EXT\.?)[\s./-]*/i, '')
          .replace(/\s*[-–]+\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS).*$/i, '')
          .trim(),
        time,
        characters: guessCharacters(part),
        temporal: /FLASHBACK|RETOUR EN ARRIÈRE/i.test(part) ? 'flashback' : 'unknown',
      });
      totalChars += part.length + 2;
    }
    if (excerpt) break;
  }
  if (!scenes.length) throw new SourceError('Aucune scène exploitable dans ce scénario.', 422);
  warnings.push(
    'MovieSum ne fournit pas les pages du scénario original. Les repères numériques désignent les scènes XML, pas des pages PDF.',
  );
  if (excerpt)
    warnings.push(
      `Extrait importé : début du scénario, limité à ${scenes.length} séquences et 180 000 caractères. Le texte source comporte ${sourceScenes.length} scènes XML.`,
    );
  if (splitScene)
    warnings.push(
      'Des scènes XML très longues ont été divisées en parties numérotées pour respecter la limite du moteur.',
    );
  const importedAt = now.toISOString();
  return {
    // Re-importing a film starts a separate project and cannot overwrite reviews.
    id: `moviesum-${crypto.randomUUID()}`,
    title: displayTitle(row.movie_name),
    author: 'Auteur du scénario non renseigné par MovieSum',
    synthetic: false,
    sourceUrl: MOVIESUM.url,
    license: 'MovieSum : CC BY-NC 4.0 déclarée',
    description: `${excerpt ? 'Extrait' : 'Scénario'} importé depuis MovieSum. ${MOVIESUM.rightsNotice}`,
    provenance: {
      type: 'moviesum',
      dataset: MOVIESUM.id,
      split,
      rowIndex: entry.row_idx,
      imdbId: /^tt\d{5,12}$/.test(row.imdb_id || '') ? row.imdb_id : null,
      attribution: MOVIESUM.attribution,
      declaredLicense: MOVIESUM.declaredLicense,
      rightsNotice: MOVIESUM.rightsNotice,
      importedAt,
      excerpt,
      originalSceneCount: sourceScenes.length,
      importedSceneCount: scenes.length,
      locator: 'xml-scene',
      transformations: [
        'Balises XML retirées',
        'Entités XML décodées',
        'Début conservé dans les limites du prototype',
        ...(splitScene ? ['Scènes longues divisées en parties'] : []),
      ],
    },
    scenes,
    warnings,
    characterCount: totalChars,
    pageCount: 0,
    text: scenes.map((scene) => scene.text).join('\n\n'),
    analysis: null,
  };
}

/**
 * API contract: GET /api/library?split=all&q=&offset=0, six local metadata entries.
 * GET /api/library/preview?split=train&rowIndex=0 reads a bounded remote excerpt.
 * POST /api/library/import { source:'moviesum', split, rowIndex, acknowledgeRights:true }.
 * Full screenplay text crosses the client boundary only after explicit import.
 */
export async function handleSources(request, env = {}, { fetcher = fetch } = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/library')) return null;
  try {
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin && origin !== url.origin)
      throw new SourceError('Origine de requête non autorisée.', 403);
    if (url.searchParams.has('url') || url.searchParams.has('dataset'))
      throw new SourceError('Seul le catalogue MovieSum configuré est autorisé.');
    if (url.pathname === '/api/library' && request.method === 'GET') {
      const split = checkSplit(url.searchParams.get('split') || 'train', true);
      const offset = checkIndex(
        url.searchParams.get('offset') || 0,
        split === 'all' ? titleIndex.count : SPLITS[split],
        'Page',
      );
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length > 100) throw new SourceError('La recherche est limitée à 100 caractères.');
      return json(searchMovieSum(split, query, offset));
    }
    if (url.pathname === '/api/library/preview' && request.method === 'GET') {
      const split = checkSplit(url.searchParams.get('split') || 'train');
      const rowIndex = checkIndex(
        url.searchParams.get('rowIndex'),
        SPLITS[split],
        'Identifiant du film',
      );
      const entry = await readMovie(
        split,
        rowIndex,
        url.searchParams.get('expectedImdbId') || undefined,
        fetcher,
        request.signal,
      );
      return json(catalogItem(entry, split));
    }
    if (url.pathname === '/api/library/import' && request.method === 'POST') {
      const raw = await readBounded(request, 2048, true);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new SourceError('Requête JSON invalide.');
      }
      if (!body || body.source !== 'moviesum' || body.url || body.dataset)
        throw new SourceError('Source d’import non autorisée.');
      if (body.acknowledgeRights !== true)
        throw new SourceError('Confirmez avoir pris connaissance des conditions de réutilisation.');
      const split = checkSplit(body.split || 'train');
      const rowIndex = checkIndex(body.rowIndex, SPLITS[split], 'Identifiant du film');
      const entry = await readMovie(split, rowIndex, body.expectedImdbId, fetcher, request.signal);
      const project = movieSumProject(entry, split);
      // The hosted viewer follows its current dataset revision. A content digest
      // identifies exactly which XML text was imported if that revision changes.
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(entry.row.script),
      );
      project.provenance.sourceSha256 = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      project.provenance.datasetRevision = 'Révision courante du Dataset Viewer à la date d’import';
      project.provenance.catalogRevision = titleIndex.datasetRevision;
      return json(project);
    }
    return json({ error: 'Route de bibliothèque introuvable.' }, 404);
  } catch (error) {
    return json(
      {
        error:
          error instanceof SourceError
            ? error.message
            : 'La bibliothèque est momentanément indisponible.',
      },
      error.status || 502,
    );
  }
}

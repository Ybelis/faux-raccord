import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { parquetReadObjects } from 'hyparquet';

const DATASET = 'rohitsaxena/MovieSum';
const SOURCE_URL = `https://huggingface.co/datasets/${DATASET}`;
const SPLITS = { train: 1800, validation: 200, test: 200 };
const MAX_DOWNLOADED_BYTES = 3 * 1024 * 1024;
let downloadedBytes = 0;
let reservedBytes = 0;
let rangeRequests = 0;

async function readJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source de métadonnées indisponible (${response.status}).`);
  return response.json();
}

/**
 * Lecture des colonnes movie_name et imdb_id, ainsi que du footer Parquet qui
 * les décrit. Aucune colonne script/summary n'est décodée ni enregistrée.
 */
function metadataFile(source) {
  return {
    byteLength: source.size,
    async slice(start, end = source.size) {
      const length = end - start;
      if (length <= 0 || length + reservedBytes > MAX_DOWNLOADED_BYTES)
        throw new Error('La récupération des métadonnées dépasse la limite de 3 Mo.');
      // Réserver avant le réseau : Hyparquet peut demander plusieurs plages
      // en parallèle, elles partagent toutes le même plafond de transfert.
      reservedBytes += length;
      const response = await fetch(source.url, {
        headers: { Range: `bytes=${start}-${end - 1}` },
        signal: AbortSignal.timeout(30000),
      });
      if (response.status !== 206) {
        await response.body?.cancel();
        throw new Error(
          'Le serveur ne respecte pas la lecture par plage ; le fichier complet est refusé.',
        );
      }
      const reader = response.body.getReader();
      const pieces = [];
      let received = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          if (received > length) throw new Error('La plage reçue dépasse la taille demandée.');
          pieces.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const buffer = new Uint8Array(received);
      let at = 0;
      for (const piece of pieces) {
        buffer.set(piece, at);
        at += piece.byteLength;
      }
      const bytes = buffer.buffer;
      if (bytes.byteLength !== length) throw new Error('Plage Parquet incomplète.');
      downloadedBytes += bytes.byteLength;
      rangeRequests++;
      return bytes;
    },
  };
}

const [metadata, parquet] = await Promise.all([
  readJSON(`https://huggingface.co/api/datasets/${DATASET}`),
  readJSON(`https://datasets-server.huggingface.co/parquet?dataset=${DATASET}`),
]);
if (!/^[a-f0-9]{40}$/.test(metadata.sha) || parquet.partial || parquet.failed?.length)
  throw new Error('La révision ou la conversion Parquet du jeu est incomplète.');

const items = [];
const files = [];
for (const [split, expectedCount] of Object.entries(SPLITS)) {
  const sources = parquet.parquet_files
    .filter((file) => file.dataset === DATASET && file.config === 'default' && file.split === split)
    .sort((left, right) => left.filename.localeCompare(right.filename));
  let rowIndex = 0;
  for (const source of sources) {
    if (!source.url.startsWith(`${SOURCE_URL}/resolve/`) || !Number.isInteger(source.size))
      throw new Error('Fichier Parquet non autorisé.');
    const rows = await parquetReadObjects({
      file: metadataFile(source),
      columns: ['movie_name', 'imdb_id'],
    });
    for (const row of rows) {
      if (typeof row.movie_name !== 'string' || !/^tt\d{5,12}$/.test(row.imdb_id))
        throw new Error('Les colonnes de métadonnées ont changé.');
      items.push({ split, rowIndex: rowIndex++, title: row.movie_name, imdbId: row.imdb_id });
    }
    files.push({ split, url: source.url, size: source.size });
  }
  if (rowIndex !== expectedCount)
    throw new Error(`Partition ${split} : ${rowIndex} lignes au lieu de ${expectedCount}.`);
}

const index = {
  dataset: DATASET,
  sourceUrl: SOURCE_URL,
  attribution: 'Rohit Saxena et Frank Keller — MovieSum (ACL 2024)',
  declaredLicense: 'CC BY-NC 4.0',
  datasetRevision: metadata.sha,
  generatedAt: new Date().toISOString(),
  columns: ['movie_name', 'imdb_id'],
  retrieval: {
    method: 'Parquet HTTP Range; metadata columns only',
    downloadedBytes,
    rangeRequests,
    files,
  },
  count: items.length,
  itemsSha256: createHash('sha256').update(JSON.stringify(items)).digest('hex'),
  items,
};
const current = await readJSON(`https://huggingface.co/api/datasets/${DATASET}`);
if (current.sha !== metadata.sha)
  throw new Error(
    'Le jeu a changé pendant la récupération. Relancez sans écraser l’index existant.',
  );
await writeFile('data/moviesum-index.json', JSON.stringify(index, null, 2) + '\n');
console.log(
  JSON.stringify({
    count: items.length,
    downloadedBytes,
    rangeRequests,
    datasetRevision: metadata.sha,
  }),
);

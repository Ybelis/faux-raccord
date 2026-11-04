import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseScreenplay } from '../src/core/parser.js';
import { retrieve } from '../src/core/retrieval.js';

// Seul le lanceur Python choisit ce corpus. Les arguments du modèle ne
// contiennent ni chemin de fichier, ni URL, ni commande à exécuter.
const CORPORA = new Map([
  ['controlled-valkaama', new URL('../data/controlled-script/project.json', import.meta.url)],
  ['valkaama', new URL('../data/valkaama.json', import.meta.url)],
]);
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const SCENE_ID = /^S[0-9]{3}$/;

class SearchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const invalid = (message) => {
  throw new SearchError('INVALID_ARGUMENTS', message);
};

async function readArguments() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) invalid('Arguments exceed the 16 KiB input limit.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    invalid('Arguments must be a JSON object.');
  }
}

function validateArguments(args) {
  // Ces contrôles protègent aussi un appel direct du pont, hors de MCP.
  if (!args || typeof args !== 'object' || Array.isArray(args))
    invalid('Arguments must be a JSON object.');
  if (Object.keys(args).some((key) => !['query', 'scene_ids', 'top_k'].includes(key)))
    invalid('Allowed arguments are query, scene_ids and top_k.');
  if (typeof args.query !== 'string' || args.query.includes('\0'))
    invalid('query must be text without NUL characters.');
  const query = args.query.trim();
  if (!query || [...args.query].length > 500)
    invalid('query must contain between 1 and 500 characters.');
  const topK = args.top_k === undefined ? 5 : args.top_k;
  if (!Number.isInteger(topK) || topK < 1 || topK > 5)
    invalid('top_k must be an integer between 1 and 5.');
  const sceneIds = args.scene_ids ?? null;
  if (
    sceneIds !== null &&
    (!Array.isArray(sceneIds) ||
      !sceneIds.length ||
      sceneIds.length > 200 ||
      sceneIds.some((id) => typeof id !== 'string' || !SCENE_ID.test(id)) ||
      new Set(sceneIds).size !== sceneIds.length)
  )
    invalid('scene_ids must be null or 1 to 200 unique identifiers such as S001.');
  return { query, topK, sceneIds };
}

async function search() {
  const options = process.argv.slice(2);
  if (
    options.length !== 4 ||
    options[0] !== '--sample' ||
    options[2] !== '--revision' ||
    !CORPORA.has(options[1]) ||
    !/^[a-f0-9]{64}$/.test(options[3])
  )
    throw new SearchError('INVALID_CONTEXT', 'Choose an allowed corpus and its source revision.');

  const args = validateArguments(await readArguments());
  const bytes = await readFile(CORPORA.get(options[1]));
  if (bytes.length > 2 * 1024 * 1024)
    throw new SearchError('INVALID_CORPUS', 'The bundled corpus exceeds its size limit.');
  const revision = createHash('sha256').update(bytes).digest('hex');
  if (revision !== options[3])
    throw new SearchError(
      'STALE_REVISION',
      'The screenplay changed; reconnect to select its new revision.',
    );

  const project = JSON.parse(bytes.toString('utf8'));
  const parsed = project.scenes
    ? { scenes: project.scenes, warnings: project.warnings || [] }
    : parseScreenplay(project.pages ? project : project.text);
  const scenes = parsed.scenes;
  if (!scenes.length || scenes.length > 200 || scenes.some((scene) => scene.text.length > 14_000))
    throw new SearchError('INVALID_CORPUS', 'The selected screenplay exceeds its scene limits.');
  if (args.sceneIds) {
    const existing = new Set(scenes.map((scene) => scene.id));
    const missing = args.sceneIds.filter((id) => !existing.has(id));
    if (missing.length)
      throw new SearchError(
        'UNKNOWN_SCENE',
        `Unknown scene identifiers: ${missing.slice(0, 5).join(', ')}. Choose scenes from the selected screenplay.`,
      );
  }
  // L'ordre du scénario reste la référence, même si les IDs arrivent inversés.
  const scope = args.sceneIds
    ? scenes.filter((scene) => args.sceneIds.includes(scene.id)).map((scene) => scene.id)
    : null;
  return {
    script: {
      id: project.id,
      title: project.title,
      revision,
      license: project.license,
      scene_count: scenes.length,
    },
    query: args.query,
    scope_scene_ids: scope,
    passages: retrieve(scenes, args.query, { topK: args.topK, sceneIds: scope || undefined }),
    warnings: [
      ...parsed.warnings,
      'Page numbers are indicative; BM25 scores rank lexical matches and are not confidence values.',
      'No matching passage does not prove that an explanation is absent.',
    ],
    model_calls: 0,
  };
}

try {
  const output = JSON.stringify(await search());
  if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES)
    throw new SearchError('OUTPUT_LIMIT', 'Search output exceeds its size limit. Reduce top_k.');
  process.stdout.write(output);
} catch (error) {
  // stdout est réservé au JSON ; aucun diagnostic interne n'entre dans les
  // résultats susceptibles d'être lus ensuite par un modèle.
  const known = error instanceof SearchError;
  process.stdout.write(
    JSON.stringify({
      error: {
        code: known ? error.code : 'SEARCH_FAILED',
        message: known
          ? error.message
          : 'Search failed. Check the bundled corpus and Node installation.',
      },
    }),
  );
  process.exitCode = 1;
}

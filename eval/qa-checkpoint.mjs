import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// À incrémenter si la politique de reprise ou de classification change.
export const CHECKPOINT_PROTOCOL_VERSION = '2.0.0';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}

// Seules les métadonnées nécessaires entrent dans l'identité. Une clé API ou
// une URL fournie dans une configuration plus large ne doit jamais y figurer.
export function checkpointKey(metadata, caseId, method) {
  const { codeHash, datasetHash, corpusHash, protocolHash, provider, model, settings } = metadata;
  return createHash('sha256')
    .update(
      JSON.stringify(
        stable({
          codeHash,
          datasetHash,
          corpusHash,
          protocolHash,
          provider,
          model,
          settings,
          caseId,
          method,
        }),
      ),
    )
    .digest('hex');
}

export function reusableOutput(output) {
  // Une réponse incorrecte selon la grille est conservée exactement comme une
  // bonne réponse. Rééchantillonner les erreurs de contenu biaiserait le score.
  return Boolean(
    output &&
      output.providerSucceeded === true &&
      !output.error &&
      typeof output.answer === 'string',
  );
}

export function cacheOutput(cache, key, output) {
  if (!reusableOutput(output)) return false;
  cache.outputs[key] = { ...output, fromCache: false };
  return true;
}

export async function readCheckpoint(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (
      value.version !== 1 ||
      !value.outputs ||
      typeof value.outputs !== 'object' ||
      Array.isArray(value.outputs)
    )
      throw new Error('Format inconnu.');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, outputs: {} };
    throw new Error(
      `Checkpoint QA illisible : ${file}. Conservez ce fichier avant de recommencer.`,
      { cause: error },
    );
  }
}

export async function writeCheckpoint(file, cache) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(cache, null, 2));
  await rename(temporary, file);
}

export function dailyQuotaReached(error) {
  if (error?.code !== 'RATE_LIMIT' && error?.status !== 429) return false;
  return /\b(?:TPD|RPD)\b|tokens?\s+per\s+day|requests?\s+per\s+day|daily\s+(?:token|request|quota|limit)/i.test(
    String(error.details || ''),
  );
}

export function safeProviderError(error) {
  const redact = (value) =>
    String(value || '')
      .replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED]')
      .replace(/org_[A-Za-z0-9]+/g, '[REDACTED_ORG]')
      .slice(0, 450);
  return {
    error: redact(error.message) || 'Erreur du fournisseur.',
    code: redact(error.code) || 'UNKNOWN',
    details: redact(error.details),
    dailyQuota: dailyQuotaReached(error),
  };
}

export function fixedContentFailure(error, milliseconds) {
  const invalidJSON =
    error?.code === 'INVALID_JSON' ||
    (error?.code === 'PROVIDER_ERROR' && /json_validate_failed/.test(String(error.message)));
  if (!invalidJSON) return null;
  // Le fournisseur a répondu, mais le modèle n'a pas produit le format requis.
  // Garder cet échec évite de réessayer jusqu'à obtenir une réponse acceptable.
  return {
    providerSucceeded: true,
    answer: '',
    citations: [],
    passed: false,
    abstained: false,
    lexicalMatch: false,
    sourceMatch: false,
    validCitations: false,
    formatError: 'INVALID_JSON',
    formatMessage: safeProviderError(error).error,
    usageUnavailable: true,
    milliseconds,
  };
}

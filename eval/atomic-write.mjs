import { writeCheckpoint } from './qa-checkpoint.mjs';

// Sous Windows, un lecteur ou l'antivirus peut garder brièvement le fichier
// ouvert. Retenter le renommage conserve l'écriture atomique : le rapport
// existant n'est jamais remplacé par un JSON à moitié écrit.
export async function writeWithRetry(
  file,
  value,
  {
    writer = writeCheckpoint,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await writer(file, value);
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 6) throw error;
      await sleep(20 * 2 ** attempt);
    }
  }
}

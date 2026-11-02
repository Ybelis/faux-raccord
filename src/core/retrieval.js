import { fold } from './parser.js';
const STOP = new Set(('the a an and of to in is it he she his her they their with on for from as at by that this was are be but or not then le la les un une des du de et en est il elle son sa ses dans sur pour par ce cette qui que au aux avec puis ne pas').split(' '));
export function tokenize(text) { return fold(text).match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !STOP.has(t)) || []; }

export function chunkScenes(scenes, maxLength = 1000) {
  const chunks = [];
  for (const scene of scenes) {
    let start = 0, index = 0;
    while (start < scene.text.length) {
      let end = Math.min(start + maxLength, scene.text.length);
      if (end < scene.text.length) {
        const boundary = scene.text.lastIndexOf('\n', end);
        if (boundary > start + maxLength / 2) end = boundary;
      }
      const text = scene.text.slice(start, end).trim();
      if (text) chunks.push({ id: `${scene.id}-C${++index}`, sceneId: scene.id, heading: scene.heading, page: scene.pages[0], text, tokens: tokenize(text), start });
      if (end >= scene.text.length) break;
      start = Math.max(start + 1, end - 150);
    }
  }
  return chunks;
}

export function retrieve(scenes, query, { topK = 5, sceneIds } = {}) {
  const chunks = chunkScenes(scenes).filter(c => !sceneIds || sceneIds.includes(c.sceneId));
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !chunks.length) return [];
  const avg = chunks.reduce((n, c) => n + c.tokens.length, 0) / chunks.length || 1;
  const df = new Map(terms.map(t => [t, chunks.filter(c => c.tokens.includes(t)).length]));
  return chunks.map(c => {
    let score = 0;
    for (const t of terms) {
      const tf = c.tokens.filter(v => v === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (chunks.length - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * c.tokens.length / avg));
    }
    return { ...c, tokens: undefined, score: Math.round(score * 1000) / 1000 };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, topK);
}

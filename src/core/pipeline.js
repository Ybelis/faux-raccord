import { fold, locateQuote } from './parser.js';
import { retrieve } from './retrieval.js';
import { callModel, effectiveModelSettings } from './model.js';
import { EXTRACT_PROMPT, JUDGE_PROMPT, QA_PROMPT, PROMPT_VERSION } from './prompts.js';

const STATES = new Set(
  'intact broken destroyed present lost empty full wet dry clean dirty open closed lit unlit loaded unloaded unknown'.split(
    ' ',
  ),
);
const ACTIONS = new Set(
  'observe break destroy repair give take lose find fill empty light extinguish clean dry unknown'.split(
    ' ',
  ),
);
// Transitions ciblées plutôt qu'une règle « tout changement est une erreur ».
// Un remplissage ou une réparation explicite peut expliquer un retour d'état.
// Cette table volontairement limitée ne couvre pas toute la continuité d'un film.
const OPPOSITE = {
  broken: ['intact'],
  destroyed: ['intact', 'present'],
  lost: ['present'],
  empty: ['full'],
  unloaded: ['loaded'],
};
const RESET = {
  broken: ['repair'],
  destroyed: [],
  lost: ['find', 'take'],
  empty: ['fill'],
  unloaded: ['fill'],
};
const known = (value) =>
  value && !['unknown', 'inconnu', 'non précisé', 'none'].includes(fold(value));

export function validateExtraction(raw, scenes) {
  // Le JSON du modèle est une proposition non fiable. On borne les listes,
  // valide les identifiants et garde seulement les mentions dont la citation
  // existe dans la scène annoncée. Une valeur hors vocabulaire reste inconnue.
  let rejected = 0;
  const objects = [];
  for (const object of (Array.isArray(raw?.objects) ? raw.objects : []).slice(0, 30)) {
    if (typeof object.name !== 'string' || !object.name.trim() || object.name.length > 100) {
      rejected++;
      continue;
    }
    const mentions = [];
    for (const mention of (Array.isArray(object.mentions) ? object.mentions : []).slice(0, 40)) {
      const scene = scenes.find((s) => s.id === mention.sceneId);
      const evidence = scene && locateQuote(scene, mention.quote);
      if (!evidence) {
        rejected++;
        continue;
      }
      mentions.push({
        ...evidence,
        state: STATES.has(mention.state) ? mention.state : 'unknown',
        owner: String(mention.owner || 'unknown').slice(0, 80),
        action: ACTIONS.has(mention.action) ? mention.action : 'unknown',
        temporal: ['continuous', 'later', 'flashback', 'unknown'].includes(mention.temporal)
          ? mention.temporal
          : 'unknown',
      });
    }
    if (mentions.length)
      objects.push({
        name: object.name.trim(),
        aliases: (Array.isArray(object.aliases) ? object.aliases : []).filter(
          (a) => typeof a === 'string' && a.length < 100,
        ),
        category: 'accessoire',
        mentions,
      });
  }
  return { objects, rejected };
}

export function mergeObjects(objects, scenes) {
  const merged = [];
  for (const object of objects) {
    const key = fold(object.name).replace(/^(?:le |la |les |un |une |the |a )/, '');
    // Les alias enrichissent la recherche, mais ne suffisent pas à fusionner
    // deux objets. La clé repose sur le nom canonique normalisé du modèle.
    const firstOwner = object.mentions.find((m) => known(m.owner))?.owner;
    const generic = key.split(/\s+/).length <= 2;
    let target = merged.find((o) => {
      if (o.key !== key) return false;
      const lastOwner = [...o.mentions].reverse().find((m) => known(m.owner))?.owner;
      const transfer = [...o.mentions, ...object.mentions].some((m) =>
        ['give', 'take'].includes(m.action),
      );
      return !(
        generic &&
        known(firstOwner) &&
        known(lastOwner) &&
        fold(firstOwner) !== fold(lastOwner) &&
        !transfer
      );
    });
    // Deux personnages peuvent avoir chacun « une cigarette » : pour les noms
    // courts, un propriétaire différent sans transfert explicite bloque la
    // fusion. Cette précaution reste une heuristique, pas une identité prouvée.
    if (!target) {
      target = {
        ...object,
        id: `OBJ${String(merged.length + 1).padStart(3, '0')}`,
        key,
        mentions: [],
      };
      merged.push(target);
    }
    target.aliases = [...new Set([...target.aliases, ...object.aliases])];
    for (const mention of object.mentions)
      if (
        !target.mentions.some(
          (m) => m.sceneId === mention.sceneId && fold(m.quote) === fold(mention.quote),
        )
      )
        target.mentions.push(mention);
  }
  for (const o of merged)
    o.mentions.sort(
      (a, b) =>
        scenes.findIndex((s) => s.id === a.sceneId) - scenes.findIndex((s) => s.id === b.sceneId),
    );
  return merged;
}

export function findCandidates(objects, scenes) {
  const candidates = [];
  for (const object of objects) {
    // On compare des mentions observées, jamais une scène où l'objet est tu.
    // L'absence de mention ne prouve ni disparition ni changement de possession.
    for (let i = 1; i < object.mentions.length; i++) {
      const before = object.mentions[i - 1],
        after = object.mentions[i];
      if (before.sceneId === after.sceneId && before.quote === after.quote) continue;
      const stateConflict = OPPOSITE[before.state]?.includes(after.state);
      const transferConflict =
        known(before.owner) &&
        known(after.owner) &&
        fold(before.owner) !== fold(after.owner) &&
        !['give', 'take', 'find'].includes(after.action);
      if (!stateConflict && !transferConflict) continue;
      if (RESET[before.state]?.includes(after.action)) continue;
      const indices = [before, after].map((m) => scenes.findIndex((s) => s.id === m.sceneId));
      const relevant = scenes.slice(Math.min(...indices), Math.max(...indices) + 1);
      // Recherche entre les deux mentions : une scène intermédiaire peut
      // expliquer la transition. Un candidat est une question, pas une alerte.
      const chunks = retrieve(relevant, [object.name, ...object.aliases].join(' '), { topK: 5 });
      candidates.push({
        id: `CAN${String(candidates.length + 1).padStart(3, '0')}`,
        entityId: object.id,
        entityName: object.name,
        type: stateConflict ? 'state' : 'ownership',
        before,
        after,
        temporalUncertain: [before, after].some(
          (m) => m.temporal === 'flashback' || m.temporal === 'later',
        ),
        context: chunks,
      });
    }
  }
  return candidates;
}

function totals(usages) {
  return usages.reduce(
    (a, u) => ({
      ...a,
      calls: a.calls + 1,
      inputTokens: a.inputTokens + u.inputTokens,
      outputTokens: a.outputTokens + u.outputTokens,
      milliseconds: a.milliseconds + u.milliseconds,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, milliseconds: 0 },
  );
}

export async function analyze(
  scenes,
  config,
  { onProgress = () => {}, model = callModel, batchSize = 3, signal, audit = () => {} } = {},
) {
  if (!scenes.length) throw new Error('Sélectionnez au moins une scène.');
  const start = Date.now(),
    usages = [],
    extracted = [];
  let rejectedEvidence = 0;
  // Lots de trois scènes pour contenir le contexte envoyé au modèle. Les noms
  // déjà extraits servent de repères, sans interdire de nouveaux accessoires.
  for (let i = 0; i < scenes.length; i += batchSize) {
    if (signal?.aborted) throw new Error('Analyse interrompue.');
    const batch = scenes.slice(i, i + batchSize);
    onProgress({
      stage: 'extract',
      done: i,
      total: scenes.length,
      message: `Lecture des scènes ${i + 1} à ${Math.min(i + batchSize, scenes.length)}…`,
    });
    const response = await model(
      config,
      EXTRACT_PROMPT,
      {
        knownObjects: extracted.slice(-40).map((o) => ({ name: o.name, aliases: o.aliases })),
        scenes: batch.map((s) => ({ sceneId: s.id, heading: s.heading, text: s.text })),
      },
      { signal },
    );
    usages.push(response.usage);
    const valid = validateExtraction(response.data, batch);
    audit({
      stage: 'extract',
      sceneIds: batch.map((s) => s.id),
      raw: response.data,
      validated: valid,
    });
    extracted.push(...valid.objects);
    rejectedEvidence += valid.rejected;
  }
  const objects = mergeObjects(extracted, scenes),
    candidates = findCandidates(objects, scenes),
    alerts = [];
  onProgress({
    stage: 'compare',
    done: scenes.length,
    total: scenes.length,
    message: `${objects.length} accessoires suivis. Vérification de ${candidates.length} points…`,
  });
  for (let i = 0; i < candidates.length; i += 5) {
    // Le second appel interprète les candidats avec leur contexte retrouvé.
    // Il peut expliquer ou nuancer un changement, mais ne peut pas créer de
    // nouvelles preuves : l'alerte reprend les deux mentions déjà validées.
    const batch = candidates.slice(i, i + 5);
    const response = await model(
      config,
      JUDGE_PROMPT,
      {
        candidates: batch.map((c) => ({
          candidateId: c.id,
          object: c.entityName,
          before: c.before,
          after: c.after,
          context: c.context,
        })),
      },
      { maxTokens: 3500, signal },
    );
    usages.push(response.usage);
    for (const c of batch) {
      const result = response.data.results?.find((r) => r.candidateId === c.id);
      if (!result || !['contradiction', 'ambiguous', 'explained'].includes(result.verdict)) {
        rejectedEvidence++;
        continue;
      }
      if (result.verdict === 'explained') continue;
      const ambiguous = result.verdict === 'ambiguous' || c.temporalUncertain;
      alerts.push({
        id: `ALT${String(alerts.length + 1).padStart(3, '0')}`,
        entityId: c.entityId,
        entityName: c.entityName,
        category: c.type,
        severity: ambiguous ? 'medium' : 'high',
        verdict: ambiguous ? 'ambiguous' : 'contradiction',
        title: String(result.title || `Continuité : ${c.entityName}`).slice(0, 140),
        description: String(result.explanation || '').slice(0, 900),
        question: String(result.question || 'Ce changement est-il volontaire ?').slice(0, 300),
        evidence: [c.before, c.after],
        retrieved: c.context.map((x) => ({ id: x.id, sceneId: x.sceneId, score: x.score })),
        status: 'pending',
        note: '',
      });
    }
  }
  const result = {
    objects,
    alerts,
    analyzedSceneIds: scenes.map((s) => s.id),
    candidateCount: candidates.length,
    rejectedEvidence,
    usage: totals(usages),
    model: config.model,
    provider: config.provider,
    settings: effectiveModelSettings(config),
    promptVersion: PROMPT_VERSION,
    completedAt: new Date().toISOString(),
    milliseconds: Date.now() - start,
  };
  onProgress({
    stage: 'complete',
    done: scenes.length,
    total: scenes.length,
    message: 'Analyse terminée.',
  });
  return result;
}

export async function answerQuestion(scenes, question, config, { model = callModel } = {}) {
  const sources = retrieve(scenes, question, { topK: 5 });
  if (!sources.length) return { answer: 'NOT FOUND', citations: [], sources: [] };
  const { data, usage } = await model(
    config,
    QA_PROMPT,
    { question, sources },
    { maxTokens: 1200 },
  );
  const ids = new Set(sources.map((s) => s.id));
  const citations = Array.isArray(data.citations) ? data.citations.filter((id) => ids.has(id)) : [];
  const inline = [...String(data.answer || '').matchAll(/\[(S\d+-C\d+)\]/g)].map((m) => m[1]);
  // La réponse doit s'appuyer sur les passages réellement retrouvés. Un
  // identifiant inventé ou incohérent déclenche l'abstention NOT FOUND.
  // Des références valides ne prouvent pas à elles seules que la réponse est
  // sémantiquement correcte : la relecture humaine reste nécessaire.
  if (
    data.answer === 'NOT FOUND' ||
    !citations.length ||
    inline.some((id) => !ids.has(id)) ||
    inline.some((id) => !citations.includes(id))
  )
    return { answer: 'NOT FOUND', citations: [], sources, usage };
  return {
    answer: String(data.answer).slice(0, 2500),
    citations,
    sources: sources.filter((s) => citations.includes(s.id)),
    usage,
  };
}

import { fold } from './core/parser.js';
import { safeExternalUrl } from './input-safety.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DEPTH = 24;
const MAX_NODES = 60000;
const MAX_TEXT = 180000;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
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
const TIMES = new Set(['continuous', 'later', 'flashback', 'unknown']);
const invalid = (detail = '') => {
  throw new Error(
    `Ce fichier ne correspond pas à un projet Faux Raccord valide.${detail ? ` ${detail}` : ''}`,
  );
};
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 1000, min = 0) =>
  typeof value === 'string' && value.length >= min && value.length <= max && !value.includes('\0');
const integer = (value, max = 1000000000) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;
const strings = (value, maxItems = 200, maxLength = 1000) =>
  Array.isArray(value) && value.length <= maxItems && value.every((item) => text(item, maxLength));
const identifier = (value) =>
  text(value, 120, 1) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !DANGEROUS_KEYS.has(value);
const date = (value) => text(value, 60, 1) && Number.isFinite(Date.parse(value));

// Bound depth before JSON.parse so a tiny but deeply nested document cannot
// later overflow recursive consumers. Quoted braces are ordinary text.
function checkRaw(raw) {
  if (
    typeof raw !== 'string' ||
    raw.length > MAX_BYTES ||
    new TextEncoder().encode(raw).length > MAX_BYTES
  )
    invalid('Le projet JSON dépasse la limite de 5 Mo.');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of raw) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      depth++;
      if (depth > MAX_DEPTH) invalid('La structure JSON est trop imbriquée.');
    } else if (char === '}' || char === ']') depth--;
  }
}

// Iterative traversal caps metadata too, including fields not currently shown.
// Dangerous property names are rejected, rather than spread or assigned later.
function checkTree(data) {
  const pending = [data];
  let nodes = 0;
  while (pending.length) {
    const value = pending.pop();
    if (++nodes > MAX_NODES) invalid('Le projet contient trop de données imbriquées.');
    if (Array.isArray(value)) {
      if (value.length > 1000) invalid('Une liste du projet dépasse la taille autorisée.');
      pending.push(...value);
    } else if (record(value)) {
      const entries = Object.entries(value);
      if (entries.length > 100) invalid('Les métadonnées du projet sont trop volumineuses.');
      for (const [key, child] of entries) {
        if (DANGEROUS_KEYS.has(key) || key.length > 100)
          invalid('Une propriété JSON non autorisée a été détectée.');
        if (
          /^(?:.*Url|href|uri|url)$/i.test(key) &&
          child != null &&
          child !== '' &&
          !safeExternalUrl(child)
        )
          invalid('Les liens de source doivent utiliser HTTP ou HTTPS, sans identifiants.');
        pending.push(child);
      }
    } else if (typeof value === 'string' && !text(value, MAX_TEXT)) invalid();
    else if (typeof value === 'number' && !Number.isFinite(value)) invalid();
  }
}

function optionalStrings(value, fields) {
  for (const [name, max] of Object.entries(fields))
    if (value[name] != null && !text(value[name], max)) invalid();
}

/** A backup is untrusted input, even when it was originally exported here. */
export function readProjectExport(raw) {
  checkRaw(raw);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    invalid('Le JSON est illisible ou incomplet.');
  }
  checkTree(data);
  const project = data?.project;
  if (
    !record(data) ||
    data.format !== 'faux-raccord-v1' ||
    !record(project) ||
    !identifier(project.id) ||
    !text(project.title, 300, 1)
  )
    invalid();
  optionalStrings(project, {
    author: 500,
    license: 300,
    language: 40,
    filename: 300,
    description: 4000,
    basedOn: 1000,
    adaptationAuthors: 1000,
    version: 100,
    text: MAX_TEXT,
  });
  for (const name of ['synthetic', 'controlled', 'importedBackup'])
    if (project[name] != null && typeof project[name] !== 'boolean') invalid();
  if (project.importedFromId != null && !identifier(project.importedFromId)) invalid();
  if (project.controlledInjectionCount != null && !integer(project.controlledInjectionCount, 1000))
    invalid();
  if (project.warnings != null && !strings(project.warnings, 200, 4000)) invalid();
  if (project.savedAt != null && !date(project.savedAt)) invalid();
  for (const name of ['characterCount', 'pageCount'])
    if (project[name] != null && !integer(project[name], 1000000)) invalid();
  if (project.provenance != null) {
    if (!record(project.provenance)) invalid();
    optionalStrings(project.provenance, {
      rightsNotice: 4000,
      type: 100,
      attribution: 1000,
      declaredLicense: 300,
    });
  }
  if (!Array.isArray(project.scenes) || !project.scenes.length || project.scenes.length > 200)
    invalid();
  const ids = new Set();
  let total = 0;
  for (const scene of project.scenes) {
    if (
      !record(scene) ||
      !/^S\d{3}$/.test(scene.id) ||
      ids.has(scene.id) ||
      !text(scene.text, MAX_TEXT, 1) ||
      !text(scene.heading, 1000) ||
      !text(scene.location, 1000) ||
      !strings(scene.characters, 200, 100)
    )
      invalid();
    optionalStrings(scene, { time: 100, sourceLocator: 200 });
    if (
      scene.sourceSceneNumber != null &&
      (!integer(scene.sourceSceneNumber, 10000) || scene.sourceSceneNumber < 1)
    )
      invalid();
    if (scene.temporal != null && !TIMES.has(scene.temporal)) invalid();
    if (scene.index != null && !integer(scene.index, 1000)) invalid();
    if (scene.pageIsSceneReference != null && typeof scene.pageIsSceneReference !== 'boolean')
      invalid();
    if (
      !Array.isArray(scene.pages) ||
      !scene.pages.length ||
      scene.pages.length > 200 ||
      !scene.pages.every((page) => integer(page, 10000) && page > 0)
    )
      invalid();
    // MovieSum source numbers may identify split scenes, e.g. 1.1 and 1.2.
    if (
      !['string', 'number'].includes(typeof scene.number) ||
      !/^\d{1,4}(?:\.\d{1,3})?$/.test(String(scene.number)) ||
      Number(scene.number) <= 0
    )
      invalid();
    if (
      scene.pageSegments != null &&
      (!Array.isArray(scene.pageSegments) ||
        scene.pageSegments.length > 200 ||
        !scene.pageSegments.every(
          (segment) =>
            record(segment) && scene.pages.includes(segment.page) && text(segment.text, MAX_TEXT),
        ))
    )
      invalid();
    ids.add(scene.id);
    total += scene.text.length;
  }
  if (total > MAX_TEXT) invalid('Le scénario dépasse 180 000 caractères.');
  if (project.analysis != null) validateAnalysis(project.analysis, project.scenes);
  return project;
}

function validateAnalysis(analysis, scenes) {
  if (!record(analysis)) invalid();
  if (analysis.warnings != null && !strings(analysis.warnings, 200, 4000)) invalid();
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  if (
    !Array.isArray(analysis.objects) ||
    analysis.objects.length > 1000 ||
    !Array.isArray(analysis.alerts) ||
    analysis.alerts.length > 1000 ||
    !strings(analysis.analyzedSceneIds, 200, 4) ||
    !analysis.analyzedSceneIds.length ||
    new Set(analysis.analyzedSceneIds).size !== analysis.analyzedSceneIds.length ||
    !analysis.analyzedSceneIds.every((id) => byId.has(id))
  )
    invalid();
  const selected = new Set(analysis.analyzedSceneIds);
  const validEvidence = (mention) => {
    if (!record(mention) || !text(mention.quote, 700, 12) || !selected.has(mention.sceneId))
      return false;
    const scene = byId.get(mention.sceneId);
    return (
      fold(scene.text).includes(fold(mention.quote)) &&
      (mention.page == null || scene.pages.includes(mention.page)) &&
      (mention.state == null || STATES.has(mention.state)) &&
      (mention.action == null || ACTIONS.has(mention.action)) &&
      (mention.temporal == null || TIMES.has(mention.temporal)) &&
      (mention.owner == null || text(mention.owner, 100))
    );
  };
  if (
    !text(analysis.model, 180, 1) ||
    !['groq', 'ollama'].includes(analysis.provider) ||
    !date(analysis.completedAt) ||
    !record(analysis.usage) ||
    !['calls', 'inputTokens', 'outputTokens'].every((key) => integer(analysis.usage[key])) ||
    !integer(analysis.milliseconds, 604800000)
  )
    invalid();
  optionalStrings(analysis, { promptVersion: 100, corpusVersion: 100, languageProfile: 100 });
  if (analysis.responseLanguage != null && !['fr', 'en'].includes(analysis.responseLanguage))
    invalid();
  for (const name of ['recorded', 'imported'])
    if (analysis[name] != null && typeof analysis[name] !== 'boolean') invalid();
  for (const name of ['candidateCount', 'rejectedEvidence'])
    if (analysis[name] != null && !integer(analysis[name], 1000000)) invalid();
  for (const name of ['milliseconds', 'logicalCalls', 'physicalCalls'])
    if (analysis.usage[name] != null && !integer(analysis.usage[name], 604800000)) invalid();
  if (analysis.settings != null) {
    const settings = analysis.settings;
    if (
      !record(settings) ||
      !Number.isFinite(settings.temperature) ||
      settings.temperature < 0 ||
      settings.temperature > 1 ||
      !integer(settings.maxOutputTokens, 16000) ||
      settings.maxOutputTokens < 256
    )
      invalid();
    if (
      settings.contextWindow != null &&
      (!integer(settings.contextWindow, 131072) || settings.contextWindow < 4096)
    )
      invalid();
    if (
      settings.reasoningEffort != null &&
      !['low', 'medium', 'high'].includes(settings.reasoningEffort)
    )
      invalid();
    if (settings.thinking != null && typeof settings.thinking !== 'boolean') invalid();
  }
  const objectIds = new Set();
  for (const object of analysis.objects) {
    if (
      !record(object) ||
      !identifier(object.id) ||
      objectIds.has(object.id) ||
      !text(object.name, 100, 1) ||
      !strings(object.aliases, 100, 100) ||
      !Array.isArray(object.mentions) ||
      object.mentions.length > 1000 ||
      !object.mentions.every(validEvidence)
    )
      invalid();
    optionalStrings(object, { category: 100, key: 200 });
    objectIds.add(object.id);
  }
  const alertIds = new Set();
  for (const alert of analysis.alerts) {
    if (
      !record(alert) ||
      !identifier(alert.id) ||
      alertIds.has(alert.id) ||
      !text(alert.title, 300, 1) ||
      !text(alert.description, 2000) ||
      !text(alert.entityName, 200, 1) ||
      (alert.note != null && !text(alert.note, 1500)) ||
      !['pending', 'confirmed', 'dismissed'].includes(alert.status)
    )
      invalid();
    optionalStrings(alert, { question: 1000 });
    if (alert.entityId != null && !objectIds.has(alert.entityId)) invalid();
    if (alert.category != null && !['state', 'ownership'].includes(alert.category)) invalid();
    if (alert.severity != null && !['low', 'medium', 'high'].includes(alert.severity)) invalid();
    if (
      alert.verdict != null &&
      !['contradiction', 'ambiguous', 'explained'].includes(alert.verdict)
    )
      invalid();
    if (
      !Array.isArray(alert.evidence) ||
      alert.evidence.length !== 2 ||
      !alert.evidence.every(validEvidence)
    )
      invalid();
    if (
      alert.retrieved != null &&
      (!Array.isArray(alert.retrieved) ||
        alert.retrieved.length > 20 ||
        !alert.retrieved.every(
          (item) =>
            record(item) &&
            text(item.id, 100, 1) &&
            selected.has(item.sceneId) &&
            Number.isFinite(item.score) &&
            item.score >= 0,
        ))
    )
      invalid();
    alertIds.add(alert.id);
  }
}

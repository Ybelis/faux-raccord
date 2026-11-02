import { fold } from './core/parser.js';

const invalid = () => {
  throw new Error('Ce fichier ne correspond pas à un projet Faux Raccord valide.');
};
const text = (value) => typeof value === 'string';
const strings = (value) => Array.isArray(value) && value.every(text);

/** A JSON backup is untrusted input, even when its filename looks familiar. */
export function readProjectExport(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    invalid();
  }
  const project = data?.project;
  if (data?.format !== 'faux-raccord-v1' || !project || !text(project.id) || !text(project.title))
    invalid();
  if (!Array.isArray(project.scenes) || !project.scenes.length || project.scenes.length > 200)
    invalid();
  const ids = new Set();
  let total = 0;
  for (const scene of project.scenes) {
    if (
      !scene ||
      !/^S\d{3}$/.test(scene.id) ||
      ids.has(scene.id) ||
      !text(scene.text) ||
      !text(scene.heading) ||
      !text(scene.location) ||
      !strings(scene.characters)
    )
      invalid();
    if (scene.time != null && !text(scene.time)) invalid();
    if (
      !Array.isArray(scene.pages) ||
      !scene.pages.length ||
      !scene.pages.every((page) => Number.isInteger(page) && page > 0)
    )
      invalid();
    // Une longue scène MovieSum peut être divisée en parties « 1.1 », « 1.2 ».
    // Le numéro affiché est un repère source ; l'identifiant S001 reste unique.
    if (!/^\d{1,4}(?:\.\d{1,3})?$/.test(String(scene.number)) || Number(scene.number) <= 0)
      invalid();
    ids.add(scene.id);
    total += scene.text.length;
  }
  if (total > 180000) invalid();
  for (const name of ['author', 'license', 'sourceUrl', 'description'])
    if (project[name] != null && !text(project[name])) invalid();
  if (project.analysis) validateAnalysis(project.analysis, project.scenes);
  return project;
}

function validateAnalysis(analysis, scenes) {
  if (analysis.warnings != null && !strings(analysis.warnings)) invalid();
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const validEvidence = (mention) =>
    mention &&
    text(mention.quote) &&
    fold(mention.quote).length >= 3 &&
    byId.has(mention.sceneId) &&
    fold(byId.get(mention.sceneId).text).includes(fold(mention.quote)) &&
    ['state', 'owner', 'action', 'temporal'].every(
      (key) => mention[key] == null || text(mention[key]),
    );
  if (
    !Array.isArray(analysis.objects) ||
    !Array.isArray(analysis.alerts) ||
    !strings(analysis.analyzedSceneIds) ||
    !analysis.analyzedSceneIds.every((id) => byId.has(id))
  )
    invalid();
  if (
    !text(analysis.model) ||
    !text(analysis.provider) ||
    !text(analysis.completedAt) ||
    !Number.isFinite(Date.parse(analysis.completedAt))
  )
    invalid();
  if (
    !analysis.usage ||
    !['calls', 'inputTokens', 'outputTokens'].every(
      (key) => Number.isFinite(analysis.usage[key]) && analysis.usage[key] >= 0,
    )
  )
    invalid();
  if (!Number.isFinite(analysis.milliseconds)) invalid();
  for (const object of analysis.objects) {
    if (
      !object ||
      !text(object.id) ||
      !text(object.name) ||
      !strings(object.aliases) ||
      !Array.isArray(object.mentions) ||
      !object.mentions.every(validEvidence)
    )
      invalid();
  }
  for (const alert of analysis.alerts) {
    if (
      !alert ||
      !text(alert.id) ||
      !text(alert.title) ||
      !text(alert.description) ||
      !text(alert.entityName) ||
      !text(alert.note || '') ||
      !['pending', 'confirmed', 'dismissed'].includes(alert.status)
    )
      invalid();
    if (
      !Array.isArray(alert.evidence) ||
      alert.evidence.length !== 2 ||
      !alert.evidence.every(validEvidence)
    )
      invalid();
  }
}

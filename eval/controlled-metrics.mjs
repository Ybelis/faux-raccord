import { createHash } from 'node:crypto';
import { fold, locateQuote, parseScreenplay } from '../src/core/parser.js';

// L'original a été haché avec des fins de ligne CRLF ; Git le stocke en LF
// (.gitattributes). Le contenu est identique : on hache donc une forme
// canonique, qui donne la même empreinte sur Windows, macOS et Linux.
export const originalSha256 = (bytes) =>
  createHash('sha256')
    .update(String(bytes.toString('utf8')).replace(/\r?\n/g, '\r\n'))
    .digest('hex');

const normalized = (text) =>
  fold(String(text || ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function wilson(successes, total) {
  if (!total) return null;
  const z = 1.96,
    p = successes / total,
    divisor = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / divisor;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / divisor;
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

// An alert must name the annotated object AND cite both annotated scenes.
// Quotes must be literal passages from the adapted script, not plausible prose.
// Each gold error can earn one true positive; duplicate alerts cost precision.
export function scoreControlledAlerts(alerts, annotations, scenes) {
  const positives = annotations.entries.filter((entry) => entry.expectedAlert);
  const consumed = new Set();
  const ledger = [];
  let tp = 0,
    fp = 0,
    unannotated = 0;
  for (const [index, alert] of alerts.entries()) {
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
    const identityText = normalized([alert.entityName, ...evidence.map((e) => e.quote)].join(' '));
    const related = annotations.entries.filter((entry) =>
      entry.objectAliases.some((alias) => identityText.includes(normalized(alias))),
    );
    const base = {
      alertId: alert.id || `BASE${String(index + 1).padStart(3, '0')}`,
      entityName: alert.entityName || '',
      relatedAnnotationIds: related.map((e) => e.errorId),
    };
    if (!related.length) {
      unannotated++;
      ledger.push({
        ...base,
        status: 'unannotated',
        reason:
          'Objet original hors du périmètre annoté : jugement humain nécessaire, exclu de la précision contrôlée.',
      });
      continue;
    }
    const checked = evidence.map((e) => {
      const scene = scenes.find((s) => s.id === e.sceneId);
      return { ...e, valid: Boolean(scene && locateQuote(scene, e.quote)) };
    });
    const named = related.filter((entry) =>
      entry.objectAliases.some((alias) => normalized(alert.entityName).includes(normalized(alias))),
    );
    const candidates = (named.length === 1 ? named : related).filter((entry) =>
      [entry.before, entry.after].every((gold) =>
        checked.some((e) => {
          if (!e.valid || e.sceneId !== gold.sceneId) return false;
          const quote = normalized(e.quote),
            target = normalized(gold.quote);
          return (
            entry.objectAliases.some((alias) => quote.includes(normalized(alias))) ||
            (quote.length >= 20 && target.includes(quote))
          );
        }),
      ),
    );
    // A long quote can name several objects. Do not assign an arbitrary gold
    // error when neither the object name nor its two quotes disambiguate it.
    const match =
      candidates.length === 1 &&
      candidates.find((entry) => entry.expectedAlert && !consumed.has(entry.errorId));
    if (match) {
      consumed.add(match.errorId);
      tp++;
      ledger.push({
        ...base,
        status: 'true-positive',
        matchedErrorId: match.errorId,
        evidence: checked,
      });
    } else {
      fp++;
      const reason =
        candidates.length > 1
          ? 'ambiguous-object-association'
          : candidates.some((e) => e.expectedAlert)
            ? 'duplicate-gold-match'
            : candidates.some((e) => !e.expectedAlert)
              ? 'explained-negative-control'
              : 'missing-or-invalid-object-evidence-pair';
      ledger.push({
        ...base,
        status: 'false-positive-controlled-scope',
        reason,
        evidence: checked,
      });
    }
  }
  const fn = positives.length - tp;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = positives.length ? tp / positives.length : null;
  return {
    scope: '19 synthetic props in scenes S001–S012 of ONE adapted Valkaama script',
    unit: 'one alert matched to one injected error, with object and both source-scene quotations',
    tp,
    fp,
    fn,
    precision,
    recall,
    f1:
      precision !== null && recall !== null && precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : 0,
    precisionCI95: wilson(tp, tp + fp),
    recallCI95: wilson(tp, positives.length),
    alertCount: alerts.length,
    unannotatedAlertCount: unannotated,
    expectedErrorCount: positives.length,
    negativeControlCount: annotations.entries.filter((e) => !e.expectedAlert).length,
    missedErrorIds: positives.filter((e) => !consumed.has(e.errorId)).map((e) => e.errorId),
    ledger,
    uncertainty:
      'Wilson 95 % descriptif ; une seule œuvre et erreurs construites dépendantes. Aucun intervalle ne prouve une généralisation à d’autres films.',
  };
}

export function validateControlledDataset(project, reference, annotations, originalBytes) {
  const issues = [];
  const scenes = parseScreenplay(project).scenes;
  const referenceScenes = parseScreenplay(reference).scenes;
  const expectedErrors = annotations.entries.filter((entry) => entry.expectedAlert);
  if (expectedErrors.length !== 15 || annotations.injectionCount !== 15)
    issues.push('Expected exactly 15 deliberate injections.');
  if (scenes.length !== 56 || referenceScenes.length !== 56)
    issues.push('Both adaptations must retain all 56 original scenes.');
  if (project.id === reference.id || !project.synthetic || !project.controlled)
    issues.push('Controlled adaptation provenance is missing.');
  if (originalBytes && originalSha256(originalBytes) !== project.provenance.originalSha256)
    issues.push('Original script hash differs.');
  const ids = new Set();
  for (const entry of annotations.entries) {
    if (ids.has(entry.errorId)) issues.push(`Duplicate annotation ${entry.errorId}`);
    ids.add(entry.errorId);
    for (const evidence of [entry.before, entry.after]) {
      const scene = scenes.find((s) => s.id === evidence.sceneId);
      if (!scene || !locateQuote(scene, evidence.quote))
        issues.push(`Missing literal evidence ${entry.errorId}/${evidence.sceneId}`);
      if (!annotations.evaluationSceneIds.includes(evidence.sceneId))
        issues.push(`Evidence outside scope ${entry.errorId}`);
    }
    const ref = referenceScenes.find((s) => s.id === entry.after.sceneId);
    if (!ref?.text.includes(entry.edit.preparedSentence))
      issues.push(`Prepared sentence missing ${entry.errorId}`);
    if (entry.expectedAlert === (entry.edit.preparedSentence === entry.edit.adaptedSentence))
      issues.push(`Injection/control edit mismatch ${entry.errorId}`);
  }
  // Reverting just the 15 declared edits must recover the coherent reference.
  const reverted = structuredClone(project.pages);
  for (const entry of expectedErrors) {
    const page = reverted.find((p) => p.text.includes(entry.edit.adaptedSentence));
    if (page)
      page.text = page.text.replace(entry.edit.adaptedSentence, entry.edit.preparedSentence);
    else issues.push(`Cannot revert declared edit ${entry.errorId}`);
  }
  if (JSON.stringify(reverted) !== JSON.stringify(reference.pages))
    issues.push('Undeclared text changes between prepared and injected versions.');
  return {
    valid: issues.length === 0,
    issues,
    sceneCount: scenes.length,
    injectionCount: expectedErrors.length,
    negativeControlCount: annotations.entries.length - expectedErrors.length,
  };
}

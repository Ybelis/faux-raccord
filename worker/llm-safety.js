export const QA_SAFETY_PROFILE = 'grounded-output-v1';

// Un identifiant dans citations[] ne suffit pas : chaque réponse affichée doit
// citer ses passages dans le texte. Ce contrôle ne juge pas l'interprétation.
export function enforceAnswerEvidence(result) {
  if (result.answer === 'NOT FOUND') return { ...result, safetyProfile: QA_SAFETY_PROFILE };
  const inline = [...String(result.answer || '').matchAll(/\[(S\d+-C\d+)\]/g)].map(
    (match) => match[1],
  );
  const citations = new Set(Array.isArray(result.citations) ? result.citations : []);
  const sources = new Set((result.sources || []).map((source) => source.id));
  const grounded =
    inline.length > 0 &&
    [...citations].every((id) => inline.includes(id) && sources.has(id)) &&
    inline.every((id) => citations.has(id) && sources.has(id));
  return grounded
    ? { ...result, safetyProfile: QA_SAFETY_PROFILE }
    : {
        ...result,
        answer: 'NOT FOUND',
        citations: [],
        safetyProfile: QA_SAFETY_PROFILE,
        abstentionReason: 'missing-or-inconsistent-inline-evidence',
      };
}

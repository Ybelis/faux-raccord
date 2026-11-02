// Ces calculs expliquent un résultat existant ; ils ne changent ni les
// prédictions enregistrées ni la règle de notation du benchmark.
export function metricsFromConfusion({ tp, fp, fn, tn }) {
  const counts = [tp, fp, fn, tn];
  if (!counts.every((value) => Number.isInteger(value) && value >= 0)) return null;
  const total = tp + fp + fn + tn;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  return {
    tp,
    fp,
    fn,
    tn,
    total,
    signaled: tp + fp,
    expectedPositive: tp + fn,
    precision,
    recall,
    f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null,
    accuracy: total ? (tp + tn) / total : null,
  };
}

export function percent(value) {
  return value == null
    ? '—'
    : `${(100 * value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

import React, { useState } from 'react';
import { CircleHelp, CheckCircle2 } from 'lucide-react';
import { Badge, Empty } from './ui.jsx';
import { metricsFromConfusion } from '../evaluation.js';
import { useI18n } from '../i18n-context.jsx';

function formatSeconds(value, language) {
  return value == null
    ? '—'
    : `${value.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 3 })} s`;
}
function formatPercent(value, language) {
  if (value == null) return '—';
  return `${(100 * value).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 })}${language === 'en' ? '%' : ' %'}`;
}

/** Une expérience à la fois : les tests de code ne sont pas un score du LLM. */
export function Evaluation({ report, analysis, onOpenControlled, onControlledScene }) {
  const { language, t } = useI18n();
  const percent = (value) => formatPercent(value, language);
  const seconds = (value) => formatSeconds(value, language);
  const controlled = report?.controlled;
  return (
    <>
      <section
        className="panel evaluation-panel controlled-evaluation"
        aria-label={t('Expérience contrôlée principale')}
      >
        <div className="evaluation-title">
          <div>
            <p className="group-label">{t('EXPÉRIENCE DE CONTINUITÉ')}</p>
            <h2>{t('15 erreurs injectées dans un seul scénario')}</h2>
          </div>
          <Badge>{t('Valkaama · adaptation')}</Badge>
        </div>
        {language === 'en' && (
          <p className="body-note">
            {t(
              'Les textes du scénario, les citations et les résultats enregistrés restent dans leur langue d’origine.',
            )}
          </p>
        )}
        <p>
          {' '}
          {t(
            'Une version préparée contient 19 accessoires ajoutés. Quinze de leurs transitions sont modifiées pour créer des incohérences ; quatre restent expliquées. Les 56 scènes sont conservées, les passages évalués se trouvent dans les scènes 1 à 12. Le scénario original reste intact.',
          )}{' '}
        </p>
        <button className="button secondary" onClick={onOpenControlled}>
          {' '}
          {t('Ouvrir le scénario de test')}{' '}
        </button>
        {controlled?.status === 'measured' ? (
          <>
            <p>
              <strong>{t('Unité : une alerte associée à une erreur injectée.')}</strong>{' '}
              {t(
                'L’association exige l’objet et deux citations vérifiables dans les scènes attendues. Chaque erreur ne rapporte qu’un vrai positif ; les doublons coûtent de la précision.',
              )}{' '}
            </p>
            <div className="table-scroll controlled-metrics">
              <table>
                <thead>
                  <tr>
                    <th>{t('Méthode')}</th>
                    <th>{t('Détectées (VP)')}</th>
                    <th>{t('Fausses alertes (FP)')}</th>
                    <th>{t('Manquées (FN)')}</th>
                    <th>{t('Précision')}</th>
                    <th>{t('Rappel')}</th>
                    <th>{t('F1')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t('Prompt simple'), controlled.baseline],
                    [t('Système'), controlled.system],
                  ].map(([label, result]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{result?.tp}</td>
                      <td>{result?.fp}</td>
                      <td>{result?.fn}</td>
                      <td>{percent(result?.precision)}</td>
                      <td>{percent(result?.recall)}</td>
                      <td>{percent(result?.f1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="body-note">
              {' '}
              {t('Même texte et modèle pour les deux méthodes :')}{' '}
              <code>{controlled.model?.id}</code>
              {t(
                '. Les alertes sur les accessoires d’origine non annotés sont exclues de cette précision contrôlée :',
              )}{' '}
              {controlled.system?.unannotatedAlertCount} {t('pour le système,')}{' '}
              {controlled.baseline?.unannotatedAlertCount}{' '}
              {t(
                'pour le prompt simple. Ce score ne mesure donc pas toutes les fausses alertes possibles dans le scénario.',
              )}{' '}
            </p>
            <details className="metric-details">
              <summary>{t('Comprendre les chiffres et leur incertitude')}</summary>
              <p>
                {' '}
                {t(
                  'Précision = VP / (VP + FP) : parmi les alertes dans le périmètre annoté, combien correspondent à une injection ? Rappel = VP / (VP + FN) : combien des 15 injections sont retrouvées ? F1 combine ces deux proportions.',
                )}{' '}
              </p>
              <p>
                {' '}
                {t(
                  'Le score exige aussi deux preuves littérales valides. Dans cet essai, le faux positif du prompt simple vient d’une citation approximative de la montre : l’erreur a été reconnue, mais la preuve est non conforme. Ce compteur ne signifie donc pas une contradiction inventée.',
                )}{' '}
              </p>
              {[
                [t('Système'), controlled.system],
                [t('Prompt simple'), controlled.baseline],
              ].map(([label, result]) => (
                <p key={label}>
                  <strong>{label} :</strong> {t('précision')} {result.tp} / ({result.tp} +{' '}
                  {result.fp}
                  {t(') ; rappel')} {result.tp} {t('/ 15. IC descriptif à 95 % : précision')}{' '}
                  {result.precisionCI95?.map(percent).join(' – ') || t('non défini')}
                  {t(', rappel')} {result.recallCI95?.map(percent).join(' – ') || t('non défini')}
                  {t('. Durée')} {seconds(result.seconds)} ;{' '}
                  {result.usage?.inputTokens?.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')}{' '}
                  {t('tokens d’entrée et')}{' '}
                  {result.usage?.outputTokens?.toLocaleString(
                    language === 'en' ? 'en-GB' : 'fr-FR',
                  )}{' '}
                  {t('de sortie. Coût catalogue indicatif :')}{' '}
                  {result.indicativeCostUSD == null
                    ? t('non estimé')
                    : `${result.indicativeCostUSD.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} USD`}
                  .
                </p>
              ))}
              <p>
                {' '}
                {t(
                  'Une seule œuvre et des erreurs construites, dépendantes les unes des autres. Le corrigé est proposé avec assistance IA et doit être relu par l’équipe. Les intervalles de Wilson décrivent l’effectif ; ils ne prouvent aucune généralisation à un tournage réel. L’association automatique vérifie les objets et passages, sans être un jugement sémantique indépendant.',
                )}{' '}
              </p>
              <p>
                {' '}
                {t('Injections manquées par le système :')}{' '}
                {controlled.system?.missedErrorIds?.join(', ') || t('aucune')}
                {t(
                  '. La baseline peut faire mieux sur ce jeu ; le rapport conserve aussi ses résultats.',
                )}{' '}
              </p>
              <p>{t(controlled.systemProtocol)}</p>
              <p>
                {t('Prompt simple :')} {t(controlled.baselineProtocol?.input)}
              </p>
              {controlled.executionNotes?.map((note) => (
                <p key={note}>{t(note)}</p>
              ))}
            </details>
            <details className="metric-details">
              <summary>{t('Voir les associations des alertes aux erreurs attendues')}</summary>
              <div className="table-scroll controlled-ledger">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Alerte')}</th>
                      <th>{t('Objet')}</th>
                      <th>{t('Résultat')}</th>
                      <th>{t('Erreur associée')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controlled.system?.ledger?.map((row) => (
                      <tr key={row.alertId}>
                        <td>{row.alertId}</td>
                        <td>{row.entityName}</td>
                        <td>
                          {{
                            'true-positive': t('Détectée'),
                            'false-positive-controlled-scope': t('Fausse alerte'),
                            unannotated: t('Hors annotation'),
                          }[row.status] || row.status}
                        </td>
                        <td>{row.matchedErrorId || row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="notice">
            {' '}
            {t(
              'La mesure contrôlée n’est pas encore complète. Aucun score n’est déduit des anciens tests.',
            )}
            {controlled?.errors?.system &&
              t(' Système : {message}', { message: t(controlled.errors.system.message) })}
            {controlled?.errors?.baseline &&
              t(' Baseline : {message}', { message: t(controlled.errors.baseline.message) })}
          </p>
        )}
        {report?.controlledAnnotations?.entries && (
          <details className="metric-details">
            <summary>
              {t('Corrigé des 15 erreurs insérées et des 4 transitions expliquées')}
            </summary>
            <p>
              {' '}
              {t(
                'Ce corrigé sert à l’évaluation. Il n’est jamais envoyé au modèle pendant l’analyse. Les citations proviennent de l’adaptation de test et ont été proposées avec assistance IA ; une relecture humaine reste nécessaire.',
              )}{' '}
            </p>
            <div className="controlled-gold">
              {report.controlledAnnotations.entries.map((entry) => (
                <section key={entry.errorId}>
                  <h3>
                    {entry.errorId} · {entry.object} ·{' '}
                    {entry.expectedAlert ? t('Erreur injectée') : t('Transition expliquée')}
                  </h3>
                  <p>{entry.reason}</p>
                  {[
                    [t('Avant'), entry.before],
                    [t('Après'), entry.after],
                  ].map(([label, source]) => (
                    <div key={label}>
                      <button
                        className="text-button"
                        onClick={() => onControlledScene(source.sceneId)}
                      >
                        {label} · {source.sceneId} {t('· repère p.')} {source.sourcePages.join('–')}
                      </button>
                      <blockquote>{source.quote}</blockquote>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </details>
        )}
        <p>
          {' '}
          {t(
            'Source : Tim Baumann, scénario de Valkaama (30 juin 2007), d’après Hendrik Behnisch.',
          )}{' '}
          <a
            href="https://www.valkaama.com/index.php?l=en&page=sources"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            {t('Publication de l’auteur')}{' '}
          </a>{' '}
          ·{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            {' '}
            {t('CC BY-SA 3.0')}{' '}
          </a>{' '}
          {t(
            '. Les ajouts et modifications sont signalés, l’adaptation conserve cette licence.',
          )}{' '}
        </p>
      </section>
      <details className="historical-evaluation">
        <summary>{t('Vérifications complémentaires')}</summary>
        <HistoricalEvaluation report={report} analysis={analysis} />
      </details>
    </>
  );
}

function HistoricalEvaluation({ report, analysis }) {
  const { language, t } = useI18n();
  const percent = (value) => formatPercent(value, language);
  const seconds = (value) => formatSeconds(value, language);
  const [method, setMethod] = useState('system');
  if (report?.status !== 'completed')
    return (
      <section className="panel">
        <Empty title={t('Évaluation non exécutée')}>
          {' '}
          {t('Le protocole et ses commandes sont disponibles dans le README.')}{' '}
        </Empty>
      </section>
    );
  const selected = report[method];
  const counts = metricsFromConfusion(selected);
  const qa = report.qa;
  const qaComplete = qa && qa.status === 'completed' && !qa.baseline?.errors && !qa.system?.errors;
  const qaFinished =
    qa?.nCompleted ??
    qa?.rows?.filter((row) => !row.baseline?.error && !row.system?.error).length ??
    0;
  const qaPlanned = qa?.nPlanned ?? qa?.n ?? 24;
  const redTeamRows = report.redTeam?.rows || [];

  return (
    <>
      <section className="notice">
        <CircleHelp size={21} />
        <p>
          <strong>{t('Ce qui est mesuré : signaler les cas qui méritent une relecture.')}</strong>{' '}
          {t(
            'Un cas est un petit scénario ; il compte comme signalé dès qu’au moins un point est produit. Ce score ne mesure pas chaque alerte d’un film complet.',
          )}{' '}
        </p>
      </section>
      <section className="panel evaluation-panel">
        <div className="evaluation-title">
          <div>
            <p className="group-label">{t('EXPÉRIENCE DE CONTINUITÉ')}</p>
            <h2>{t('Comparer au prompt simple')}</h2>
          </div>
          <Badge>
            {report.n} {t('cas synthétiques')}
          </Badge>
        </div>
        <p>
          {' '}
          {t(
            'Les deux méthodes reçoivent les mêmes textes et utilisent le même modèle. Le prompt simple demande directement de repérer les changements. Le système extrait les accessoires, recherche le contexte, puis compare les passages.',
          )}{' '}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('Méthode')}</th>
                <th>{t('Précision')}</th>
                <th>{t('Rappel')}</th>
                <th>{t('F1')}</th>
                <th>{t('Latence médiane')}</th>
              </tr>
            </thead>
            <tbody>
              {[
                [t('Prompt simple'), report.baseline],
                [t('Extraction + recherche + comparaison'), report.system],
              ].map(([label, metrics]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {['precision', 'recall', 'f1'].map((metric) => (
                    <td key={metric}>{percent(metrics?.[metric])}</td>
                  ))}
                  <td>{seconds(metrics?.medianSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>{t('Le compromis observé :')}</strong>{' '}
          {t('le système réduit les fausses alertes de')} {report.baseline.fp} {t('à')}{' '}
          {report.system.fp}
          {t(', mais manque')} {report.system.fn}{' '}
          {t(
            'cas positifs. Le prompt simple a ici un meilleur F1. Ces résultats ne prouvent pas une supériorité générale du système.',
          )}{' '}
        </p>
        <details className="metric-details">
          <summary>{t('Comment les cas ont-ils été préparés ?')}</summary>
          <p>
            {' '}
            {t(
              '60 exemples synthétiques : 10 pour développer, puis 50 réservés pour cette exécution. Parmi les 50, 21 comportent un changement à relever et 29 n’en comportent pas selon les annotations proposées. Certains cas sont proches de ceux du développement ; la séparation des fichiers ne garantit pas leur indépendance.',
            )}{' '}
          </p>
          <p>
            {' '}
            {t(
              'Les annotations ont été proposées avec assistance IA. Leur relecture automatique ne remplace pas une validation humaine. Les scores restent ceux de la version, du modèle et des paramètres enregistrés.',
            )}{' '}
          </p>
        </details>
      </section>

      {counts && (
        <section
          className="panel evaluation-panel metric-explainer"
          aria-label={t('Comprendre les métriques')}
        >
          <div className="evaluation-title">
            <div>
              <p className="group-label">{t('D’OÙ VIENNENT LES POURCENTAGES ?')}</p>
              <h2>{t('Lire les résultats en nombres de cas')}</h2>
            </div>
            <div
              className="segmented metric-method"
              role="group"
              aria-label={t('Méthode à expliquer')}
            >
              <button
                className={method === 'system' ? 'selected' : ''}
                aria-pressed={method === 'system'}
                onClick={() => setMethod('system')}
              >
                {' '}
                {t('Système')}{' '}
              </button>
              <button
                className={method === 'baseline' ? 'selected' : ''}
                aria-pressed={method === 'baseline'}
                onClick={() => setMethod('baseline')}
              >
                {' '}
                {t('Prompt simple')}{' '}
              </button>
            </div>
          </div>
          <div className="confusion-grid">
            <div>
              <strong>{counts.tp}</strong>
              <span>{t('cas positifs signalés')}</span>
              <small>{t('Vrais positifs : le cas positif est signalé.')}</small>
            </div>
            <div>
              <strong>{counts.fp}</strong>
              <span>{t('fausses alertes')}</span>
              <small>{t('Faux positifs : le cas est signalé à tort.')}</small>
            </div>
            <div>
              <strong>{counts.fn}</strong>
              <span>{t('cas positifs manqués')}</span>
              <small>{t('Faux négatifs : aucun point n’est signalé.')}</small>
            </div>
            <div>
              <strong>{counts.tn}</strong>
              <span>{t('cas négatifs non signalés')}</span>
              <small>{t('Vrais négatifs : pas de fausse alerte.')}</small>
            </div>
          </div>
          <dl className="metric-definitions">
            <div>
              <dt>
                {' '}
                {t('Précision')} <strong>{percent(counts.precision)}</strong>
              </dt>
              <dd>
                {' '}
                {t('Parmi les')} {counts.signaled} {t('cas signalés, combien devaient l’être ?')}{' '}
                <code>
                  {counts.tp} / ({counts.tp} + {counts.fp}) = {percent(counts.precision)}
                </code>{' '}
                {t('Elle indique la proportion de signalements justifiés dans ce jeu.')}{' '}
              </dd>
            </div>
            <div>
              <dt>
                {' '}
                {t('Rappel')} <strong>{percent(counts.recall)}</strong>
              </dt>
              <dd>
                {' '}
                {t('Parmi les')} {counts.expectedPositive}{' '}
                {t('cas positifs, combien sont retrouvés ?')}{' '}
                <code>
                  {counts.tp} / ({counts.tp} + {counts.fn}) = {percent(counts.recall)}
                </code>{' '}
                {t('Il rend visibles les oublis du système.')}{' '}
              </dd>
            </div>
            <div>
              <dt>
                {' '}
                {t('F1')} <strong>{percent(counts.f1)}</strong>
              </dt>
              <dd>
                {' '}
                {t('Une mesure qui combine précision et rappel.')}{' '}
                <code>{t('2 × précision × rappel / (précision + rappel)')}</code>
                {t(
                  'Elle diminue si l’une des deux mesures est faible ; elle ne choisit pas le compromis à la place de l’utilisateur.',
                )}{' '}
              </dd>
            </div>
          </dl>
          <details className="metric-details">
            <summary>
              {' '}
              {t('Pourquoi ne pas donner uniquement le pourcentage de bonnes décisions ?')}{' '}
            </summary>
            <p>
              {' '}
              {t('La justesse globale, ou accuracy, vaut ici (')}
              {counts.tp} + {counts.tn}) / {counts.total} ={' '}
              <strong>{percent(counts.accuracy)}</strong>
              {t(
                '. Elle mélange cas positifs et négatifs. Un système qui ne signale jamais rien réussirait déjà 29 cas sur 50, soit 58 %, tout en manquant les 21 changements. C’est pourquoi nous affichons précision et rappel séparément.',
              )}{' '}
            </p>
          </details>
          <details className="metric-details">
            <summary>{t('Comment lire l’intervalle de confiance à 95 % ?')}</summary>
            <p>
              {' '}
              {t('Pour cette précision, l’intervalle de Wilson est')}{' '}
              {selected.precisionCI?.map(percent).join(' – ')}
              {t(
                '. Il montre que l’estimation reste incertaine avec peu de signalements. Il ne signifie pas que chaque alerte est fiable à 95 % et ne corrige ni les annotations discutables, ni le biais des cas synthétiques.',
              )}{' '}
            </p>
            <p>
              {' '}
              {t(
                'La borne basse du système est de 74,2 %. Cette expérience ne permet donc pas d’affirmer qu’un seuil de 80 % est garanti.',
              )}{' '}
            </p>
          </details>
          <details className="metric-details">
            <summary>{t('Que signifient latence, tokens et coût ?')}</summary>
            <p>
              {' '}
              {t(
                'La latence médiane sépare les cas en deux moitiés : une moitié prend moins de temps, l’autre davantage. Elle inclut les attentes observées ; ce n’est pas un délai garanti pour un scénario complet.',
              )}{' '}
            </p>
            <p>
              {' '}
              {t(
                'Les tokens sont les unités de texte comptées par le modèle. Pour cette méthode :',
              )}{' '}
              {selected.inputTokens?.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')}{' '}
              {t('en entrée,')}{' '}
              {selected.outputTokens?.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')}{' '}
              {t(
                'en sortie. Le coût estimé se calcule séparément pour l’entrée et la sortie à partir d’un tarif daté ; il ne correspond pas nécessairement à une facture.',
              )}{' '}
            </p>
          </details>
        </section>
      )}

      <section className="panel evaluation-panel">
        <p className="group-label">{t('PLUSIEURS VÉRIFICATIONS, PLUSIEURS QUESTIONS')}</p>
        <h2>{t('Ce que les autres tests permettent de conclure')}</h2>
        <div className="test-scope-list">
          <article>
            <h3>{t('Tests du code et des parcours')}</h3>
            <p>
              {' '}
              {t(
                'Vérifient le découpage des scènes, les citations, les limites d’import, les réglages, la sauvegarde et les boutons. Des fournisseurs simulés rendent ces contrôles reproductibles. Un test logiciel réussi ne prouve pas que le LLM comprend correctement un scénario.',
              )}{' '}
            </p>
            <code>npm test · scripts/check-*.mjs</code>
          </article>
          <article>
            <h3>
              {' '}
              {t('Questions sur Valkaama')}{' '}
              <Badge tone={qaComplete ? 'mint' : 'amber'}>
                {qaComplete ? t('Exécution complète') : t('Comparaison incomplète')}
              </Badge>
            </h3>
            {qa?.model && (
              <p className="body-note">
                {' '}
                {t('Profil QA :')} <code>{qa.model}</code>
                {t('. Cette expérience est distincte du benchmark de continuité.')}{' '}
              </p>
            )}
            <p>
              {qaFinished} / {qaPlanned}{' '}
              {t(
                'questions disposent des deux sorties nécessaires. Les questions utilisent de vrais passages du scénario, dont quatre informations absentes. Cette expérience mesure une réponse, une référence et un contrat de format ; elle ne mesure pas les faux raccords.',
              )}{' '}
            </p>
            {qaComplete ? (
              <p>
                {' '}
                {t('Prompt simple :')} {qa.baseline.passed} / {qaPlanned}
                {t('. Avec recherche :')} {qa.system.passed} / {qaPlanned}
                {t('. La grille reste à faire relire.')}{' '}
              </p>
            ) : (
              <p>
                {' '}
                {t(
                  'Les erreurs de quota ou de connexion empêchent une comparaison complète. Aucun score global de qualité n’est revendiqué sur cet essai.',
                )}{' '}
              </p>
            )}
          </article>
          <article>
            <h3>{t('Recherche de passages')}</h3>
            <p>
              {report.retrieval?.n ?? 12}{' '}
              {t(
                'requêtes de référence dans Valkaama. Le rappel à cinq résultats indique si la bonne scène apparaît parmi les cinq premiers passages.',
              )}{' '}
              {report.retrieval && (
                <>
                  {t('Résultat enregistré :')} {percent(report.retrieval.value)}.
                </>
              )}{' '}
              {t('Cela ne vérifie pas la réponse générée ensuite.')}{' '}
            </p>
          </article>
          <article>
            <h3>{t('Essais adversariaux')}</h3>
            <p>
              {redTeamRows.length
                ? t(
                    '{passed}/{total} cas conformes à la grille historique : {questions} questions et {edits} éditions.',
                    {
                      passed: redTeamRows.filter((row) => row.passed).length,
                      total: redTeamRows.length,
                      questions: redTeamRows.filter((row) => row.kind !== 'edit').length,
                      edits: redTeamRows.filter((row) => row.kind === 'edit').length,
                    },
                  )
                : t('Aucun essai adversarial enregistré.')}
            </p>
            <p>
              {t(
                'Cette campagne précède les nouveaux contrôles de réponse et d’édition. Sa grille ne démontre pas une résistance générale aux injections.',
              )}
            </p>
          </article>
        </div>
      </section>

      <div className="evaluation-columns">
        <section className="panel">
          <h2>{t('Ce qui est vérifié dans une citation')}</h2>
          <p>
            {' '}
            {t(
              'Le code contrôle que les mots existent dans la scène et que les identifiants sont autorisés. Le modèle peut encore mal interpréter un passage réel. L’utilisateur doit donc lire les deux extraits avant de décider.',
            )}{' '}
          </p>
        </section>
        <section className="panel">
          <h2>{t('Dernière exécution du projet')}</h2>
          {analysis ? (
            <>
              <p>
                <code>{analysis.model}</code> {t('· prompt')} {analysis.promptVersion}
              </p>
              <p>
                {analysis.usage.calls} {t('appels ·')}{' '}
                {analysis.usage.inputTokens.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')}{' '}
                {t('tokens d’entrée ·')} {seconds(analysis.milliseconds / 1000)}.
              </p>
              <p>
                {analysis.rejectedEvidence} {t('citation(s) ou résultat(s) non conformes écartés.')}
              </p>
            </>
          ) : (
            <p>{t('Aucune analyse dans ce projet.')}</p>
          )}
        </section>
      </div>
    </>
  );
}

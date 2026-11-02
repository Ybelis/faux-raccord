import React, { useState } from 'react';
import { CircleHelp, CheckCircle2 } from 'lucide-react';
import { Badge, Empty } from './ui.jsx';
import { metricsFromConfusion, percent } from '../evaluation.js';

function seconds(value) {
  return value == null ? '—' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} s`;
}

/** Une expérience à la fois : les tests de code ne sont pas un score du LLM. */
export function Evaluation({ report, analysis }) {
  const [method, setMethod] = useState('system');
  if (report?.status !== 'completed')
    return (
      <section className="panel">
        <Empty title="Évaluation non exécutée">
          Le protocole et ses commandes sont disponibles dans le README.
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

  return (
    <>
      <section className="notice">
        <CircleHelp size={21} />
        <p>
          <strong>Ce qui est mesuré : signaler les cas qui méritent une relecture.</strong> Un cas
          est un petit scénario ; il compte comme signalé dès qu’au moins un point est produit. Ce
          score ne mesure pas chaque alerte d’un film complet.
        </p>
      </section>
      <section className="panel evaluation-panel">
        <div className="evaluation-title">
          <div>
            <p className="group-label">EXPÉRIENCE DE CONTINUITÉ</p>
            <h2>Comparer au prompt simple</h2>
          </div>
          <Badge>{report.n} cas synthétiques</Badge>
        </div>
        <p>
          Les deux méthodes reçoivent les mêmes textes et utilisent le même modèle. Le prompt simple
          demande directement de repérer les changements. Le système extrait les accessoires,
          recherche le contexte, puis compare les passages.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Méthode</th>
                <th>Précision</th>
                <th>Rappel</th>
                <th>F1</th>
                <th>Latence médiane</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Prompt simple', report.baseline],
                ['Extraction + recherche + comparaison', report.system],
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
          <strong>Le compromis observé :</strong> le système réduit les fausses alertes de{' '}
          {report.baseline.fp} à {report.system.fp}, mais manque {report.system.fn} cas positifs. Le
          prompt simple a ici un meilleur F1. Ces résultats ne prouvent pas une supériorité générale
          du système.
        </p>
        <details className="metric-details">
          <summary>Comment les cas ont-ils été préparés ?</summary>
          <p>
            60 exemples synthétiques : 10 pour développer, puis 50 réservés pour cette exécution.
            Parmi les 50, 21 comportent un changement à relever et 29 n’en comportent pas selon les
            annotations proposées. Certains cas sont proches de ceux du développement ; la
            séparation des fichiers ne garantit pas leur indépendance.
          </p>
          <p>
            Les annotations ont été proposées avec assistance IA. Leur relecture automatique ne
            remplace pas une validation humaine. Les scores restent ceux de la version, du modèle et
            des paramètres enregistrés.
          </p>
        </details>
      </section>

      {counts && (
        <section
          className="panel evaluation-panel metric-explainer"
          aria-label="Comprendre les métriques"
        >
          <div className="evaluation-title">
            <div>
              <p className="group-label">D’OÙ VIENNENT LES POURCENTAGES ?</p>
              <h2>Lire les résultats en nombres de cas</h2>
            </div>
            <div className="segmented metric-method" role="group" aria-label="Méthode à expliquer">
              <button
                className={method === 'system' ? 'selected' : ''}
                aria-pressed={method === 'system'}
                onClick={() => setMethod('system')}
              >
                Système
              </button>
              <button
                className={method === 'baseline' ? 'selected' : ''}
                aria-pressed={method === 'baseline'}
                onClick={() => setMethod('baseline')}
              >
                Prompt simple
              </button>
            </div>
          </div>
          <div className="confusion-grid">
            <div>
              <strong>{counts.tp}</strong>
              <span>cas positifs signalés</span>
              <small>Vrais positifs : le cas positif est signalé.</small>
            </div>
            <div>
              <strong>{counts.fp}</strong>
              <span>fausses alertes</span>
              <small>Faux positifs : le cas est signalé à tort.</small>
            </div>
            <div>
              <strong>{counts.fn}</strong>
              <span>cas positifs manqués</span>
              <small>Faux négatifs : aucun point n’est signalé.</small>
            </div>
            <div>
              <strong>{counts.tn}</strong>
              <span>cas négatifs non signalés</span>
              <small>Vrais négatifs : pas de fausse alerte.</small>
            </div>
          </div>
          <dl className="metric-definitions">
            <div>
              <dt>
                Précision <strong>{percent(counts.precision)}</strong>
              </dt>
              <dd>
                Parmi les {counts.signaled} cas signalés, combien devaient l’être ?
                <code>
                  {counts.tp} / ({counts.tp} + {counts.fp}) = {percent(counts.precision)}
                </code>
                Elle indique la proportion de signalements justifiés dans ce jeu.
              </dd>
            </div>
            <div>
              <dt>
                Rappel <strong>{percent(counts.recall)}</strong>
              </dt>
              <dd>
                Parmi les {counts.expectedPositive} cas positifs, combien sont retrouvés ?
                <code>
                  {counts.tp} / ({counts.tp} + {counts.fn}) = {percent(counts.recall)}
                </code>
                Il rend visibles les oublis du système.
              </dd>
            </div>
            <div>
              <dt>
                F1 <strong>{percent(counts.f1)}</strong>
              </dt>
              <dd>
                Une mesure qui combine précision et rappel.
                <code>2 × précision × rappel / (précision + rappel)</code>Elle diminue si l’une des
                deux mesures est faible ; elle ne choisit pas le compromis à la place de
                l’utilisateur.
              </dd>
            </div>
          </dl>
          <details className="metric-details">
            <summary>
              Pourquoi ne pas donner uniquement le pourcentage de bonnes décisions ?
            </summary>
            <p>
              La justesse globale, ou accuracy, vaut ici ({counts.tp} + {counts.tn}) /{' '}
              {counts.total} = <strong>{percent(counts.accuracy)}</strong>. Elle mélange cas
              positifs et négatifs. Un système qui ne signale jamais rien réussirait déjà 29 cas sur
              50, soit 58 %, tout en manquant les 21 changements. C’est pourquoi nous affichons
              précision et rappel séparément.
            </p>
          </details>
          <details className="metric-details">
            <summary>Comment lire l’intervalle de confiance à 95 % ?</summary>
            <p>
              Pour cette précision, l’intervalle de Wilson est{' '}
              {selected.precisionCI?.map(percent).join(' – ')}. Il montre que l’estimation reste
              incertaine avec peu de signalements. Il ne signifie pas que chaque alerte est fiable à
              95 % et ne corrige ni les annotations discutables, ni le biais des cas synthétiques.
            </p>
            <p>
              La borne basse du système est de 74,2 %. Cette expérience ne permet donc pas
              d’affirmer qu’un seuil de 80 % est garanti.
            </p>
          </details>
          <details className="metric-details">
            <summary>Que signifient latence, tokens et coût ?</summary>
            <p>
              La latence médiane sépare les cas en deux moitiés : une moitié prend moins de temps,
              l’autre davantage. Elle inclut les attentes observées ; ce n’est pas un délai garanti
              pour un scénario complet.
            </p>
            <p>
              Les tokens sont les unités de texte comptées par le modèle. Pour cette méthode :{' '}
              {selected.inputTokens?.toLocaleString('fr-FR')} en entrée,{' '}
              {selected.outputTokens?.toLocaleString('fr-FR')} en sortie. Le coût estimé se calcule
              séparément pour l’entrée et la sortie à partir d’un tarif daté ; il ne correspond pas
              nécessairement à une facture.
            </p>
          </details>
        </section>
      )}

      <section className="panel evaluation-panel">
        <p className="group-label">PLUSIEURS VÉRIFICATIONS, PLUSIEURS QUESTIONS</p>
        <h2>Ce que les autres tests permettent de conclure</h2>
        <div className="test-scope-list">
          <article>
            <h3>Tests du code et des parcours</h3>
            <p>
              Vérifient le découpage des scènes, les citations, les limites d’import, les réglages,
              la sauvegarde et les boutons. Des fournisseurs simulés rendent ces contrôles
              reproductibles. Un test logiciel réussi ne prouve pas que le LLM comprend correctement
              un scénario.
            </p>
            <code>npm test · scripts/check-*.mjs</code>
          </article>
          <article>
            <h3>
              Questions sur Valkaama{' '}
              <Badge tone={qaComplete ? 'mint' : 'amber'}>
                {qaComplete ? 'Exécution complète' : 'Comparaison incomplète'}
              </Badge>
            </h3>
            <p>
              {qaFinished} / {qaPlanned} questions disposent des deux sorties nécessaires. Les
              questions utilisent de vrais passages du scénario, dont quatre informations absentes.
              Cette expérience mesure une réponse, une référence et un contrat de format ; elle ne
              mesure pas les faux raccords.
            </p>
            {qaComplete ? (
              <p>
                Prompt simple : {qa.baseline.passed} / {qaPlanned}. Avec recherche :{' '}
                {qa.system.passed} / {qaPlanned}. La grille reste à faire relire.
              </p>
            ) : (
              <p>
                Les erreurs de quota ou de connexion empêchent une comparaison complète. Aucun score
                global de qualité n’est revendiqué sur cet essai.
              </p>
            )}
          </article>
          <article>
            <h3>Recherche de passages</h3>
            <p>
              {report.retrieval?.n ?? 12} requêtes de référence dans Valkaama. Le rappel à cinq
              résultats indique si la bonne scène apparaît parmi les cinq premiers passages.{' '}
              {report.retrieval && <>Résultat enregistré : {percent(report.retrieval.value)}.</>}{' '}
              Cela ne vérifie pas la réponse générée ensuite.
            </p>
          </article>
          <article>
            <h3>Essais adversariaux</h3>
            <p>
              Des demandes essaient de détourner les instructions ou d’obtenir un secret. Les trois
              essais enregistrés n’ont pas réussi à le faire ; trois exemples ne prouvent pas une
              résistance générale.
            </p>
          </article>
        </div>
      </section>

      <div className="evaluation-columns">
        <section className="panel">
          <h2>Ce qui est vérifié dans une citation</h2>
          <p>
            Le code contrôle que les mots existent dans la scène et que les identifiants sont
            autorisés. Le modèle peut encore mal interpréter un passage réel. L’utilisateur doit
            donc lire les deux extraits avant de décider.
          </p>
        </section>
        <section className="panel">
          <h2>Dernière exécution du projet</h2>
          {analysis ? (
            <>
              <p>
                <code>{analysis.model}</code> · prompt {analysis.promptVersion}
              </p>
              <p>
                {analysis.usage.calls} appels · {analysis.usage.inputTokens.toLocaleString('fr-FR')}{' '}
                tokens d’entrée · {seconds(analysis.milliseconds / 1000)}.
              </p>
              <p>{analysis.rejectedEvidence} citation(s) ou résultat(s) non conformes écartés.</p>
            </>
          ) : (
            <p>Aucune analyse dans ce projet.</p>
          )}
        </section>
      </div>
    </>
  );
}

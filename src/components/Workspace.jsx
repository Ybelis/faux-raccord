import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  LoaderCircle,
  Package,
  Play,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { fold } from '../core/parser.js';
import { Badge, Empty, SearchField } from './ui.jsx';
import { useI18n } from '../i18n-context.jsx';

const STATES = {
  intact: 'Intact',
  broken: 'Brisé',
  destroyed: 'Détruit',
  present: 'Présent',
  lost: 'Perdu',
  empty: 'Vide',
  full: 'Plein',
  wet: 'Mouillé',
  dry: 'Sec',
  clean: 'Propre',
  dirty: 'Sale',
  open: 'Ouvert',
  closed: 'Fermé',
  lit: 'Allumé',
  unlit: 'Éteint',
  loaded: 'Chargé',
  unloaded: 'Déchargé',
  unknown: 'Non précisé',
};
const STATUS = { pending: 'À vérifier', confirmed: 'Confirmé', dismissed: 'Écarté' };
const stateLabel = (state, t) => t(STATES[state] || state || 'Non précisé');

/** XML imports have scene locators, not genuine PDF page numbers. */
function sourceLabel(scene, page, t) {
  if (!scene) return t('Source indisponible');
  if (scene.pageIsSceneReference)
    return scene.sourceLocator || t('Scène XML {number}', { number: scene.number });
  return t('Scène {number} · p. {pages}', {
    number: scene.number,
    pages: page || scene.pages.join('–'),
  });
}

function AnalysisWarnings({ analysis }) {
  const { t } = useI18n();
  if (!analysis?.warnings?.length) return null;
  return (
    <aside className="notice warning-notice" role="status">
      <CircleHelp size={20} />
      <div>
        {analysis.warnings.map((message, index) => (
          <p key={index}>{t(message)}</p>
        ))}
      </div>
    </aside>
  );
}

export function ScriptWorkspace({ project, activeScene, onScene, onReview, onAnalyze }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const selected = project.scenes.find((scene) => scene.id === activeScene) || project.scenes[0];
  const matching = project.scenes.filter((scene) => fold(scene.text).includes(fold(query)));
  const selectedIndex = project.scenes.findIndex((scene) => scene.id === selected?.id);
  const allAlerts = project.analysis?.alerts || [];
  const sceneAlerts = allAlerts.filter((alert) =>
    alert.evidence.some((item) => item.sceneId === selected?.id),
  );
  return (
    <>
      <section className="document-summary panel">
        <div className="document-title">
          <FileText size={25} />
          <div>
            <h2>{project.title}</h2>
            <p>{project.author}</p>
          </div>
          <Badge tone={project.synthetic ? 'amber' : 'mint'}>
            {project.controlled
              ? t('{count} erreurs injectées', { count: project.controlledInjectionCount })
              : project.synthetic
                ? t('Fiction synthétique')
                : t('Scénario réel')}
          </Badge>
        </div>
        <div className="document-facts">
          <span>
            <strong>{project.scenes.length}</strong> {t('scènes')}{' '}
          </span>
          <span>{project.license || t('Droits à documenter')}</span>
          {project.analysis && (
            <span>
              <strong>{project.analysis.analyzedSceneIds.length}</strong>{' '}
              {t('scènes analysées')}{' '}
            </span>
          )}
        </div>
        <p className="document-purpose">
          {t(
            'Faux Raccord compare les passages où un accessoire change d’état ou de propriétaire. Vous relisez les changements signalés ; le texte du scénario reste inchangé.',
          )}
        </p>
        <details className="provenance">
          <summary>{t('Provenance et conditions d’utilisation')}</summary>
          <p>{project.description || t('Document ajouté par l’utilisateur.')}</p>
          {project.sourceUrl && (
            <a href={project.sourceUrl} target="_blank" rel="noreferrer">
              {' '}
              {t('Consulter la source')} <ExternalLink size={14} />
            </a>
          )}
          <p>
            {' '}
            {t('Attribution :')} {project.author}
            {t('. Licence :')} {project.license || t('à documenter')}.
          </p>
          {project.provenance?.rightsNotice && <p>{project.provenance.rightsNotice}</p>}
          {project.controlled && (
            <p>
              {' '}
              {t(
                'Adaptation de test : les passages ajoutés et modifiés sont artificiels. Les pages situent les scènes dans l’original ; le PDF original ne contient pas ces ajouts.',
              )}{' '}
            </p>
          )}
          {project.scenes.some((scene) => scene.pageIsSceneReference) && (
            <p>
              {' '}
              {t(
                'Les repères proviennent des scènes XML de MovieSum. Ils ne correspondent pas aux pages d’un PDF original.',
              )}{' '}
            </p>
          )}
          {project.warnings?.map((warning, index) => (
            <p key={index} className="warning-text">
              {warning}
            </p>
          ))}
        </details>
        <div className="document-next-action">
          <div>
            <strong>
              {project.analysis
                ? t('Un résultat est prêt à consulter')
                : t('Commencez par vérifier le texte ci-dessous')}
            </strong>
            <p>
              {project.analysis
                ? t(
                    '{scenes} scènes analysées · {alerts} points signalés. Vous pouvez les lire sans relancer le modèle.',
                    {
                      scenes: project.analysis.analyzedSceneIds.length,
                      alerts: allAlerts.length,
                    },
                  )
                : t(
                    'Choisissez ensuite les scènes à analyser. Vous obtiendrez des points à vérifier, accompagnés de leurs passages sources.',
                  )}
            </p>
          </div>
          <button
            className="button primary"
            onClick={project.analysis ? () => onReview() : onAnalyze}
          >
            {project.analysis ? t('Voir le résultat') : t('Configurer l’analyse')}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section
        className="script-workbench panel"
        data-tour="script"
        aria-label={t('Lecture du scénario')}
      >
        <aside className="scene-sidebar">
          <div className="scene-list-heading">
            <h2>
              {' '}
              {t('Scènes')} <span>{project.scenes.length}</span>
            </h2>
            <SearchField value={query} onChange={setQuery} label={t('Chercher dans le texte')} />
          </div>
          <nav className="scene-list" aria-label={t('Scènes du scénario')}>
            {matching.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onScene(scene.id)}
                className={selected?.id === scene.id ? 'selected' : ''}
                aria-current={selected?.id === scene.id ? 'true' : undefined}
              >
                <span className="scene-number">{String(scene.number).padStart(2, '0')}</span>
                <span>
                  <strong>{scene.location || scene.heading}</strong>
                  <small>
                    {scene.time || t('Temps non précisé')} ·{' '}
                    {scene.pageIsSceneReference ? t('repère XML') : `p. ${scene.pages[0]}`}
                  </small>
                </span>
                {allAlerts.some((alert) =>
                  alert.evidence.some((item) => item.sceneId === scene.id),
                ) && <span className="alert-dot" />}
              </button>
            ))}
          </nav>
          {!matching.length && (
            <p className="list-empty">{t('Aucune scène ne contient ce texte.')}</p>
          )}
        </aside>
        <article className="script-page">
          <header className="script-page-tools">
            <span>{sourceLabel(selected, undefined, t)}</span>
            <div>
              <button
                className="icon-button"
                aria-label={t('Scène précédente')}
                disabled={selectedIndex === 0}
                onClick={() => onScene(project.scenes[selectedIndex - 1].id)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={t('Scène suivante')}
                disabled={selectedIndex === project.scenes.length - 1}
                onClick={() => onScene(project.scenes[selectedIndex + 1].id)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </header>
          <div className="script-paper">
            <span className="paper-label">{t('TEXTE DU SCÉNARIO')}</span>
            <pre>{selected?.text}</pre>
          </div>
          {sceneAlerts.map((alert) => (
            <button className="scene-alert-link" key={alert.id} onClick={() => onReview(alert.id)}>
              <CircleHelp size={17} />
              {alert.title}
              <ArrowRight size={16} />
            </button>
          ))}
        </article>
      </section>
    </>
  );
}

export function AnalysisWorkspace({
  project,
  selection,
  system,
  startScene,
  scope,
  onStart,
  onScope,
  consent,
  onConsent,
  replaceConsent,
  onReplaceConsent,
  busy,
  progress,
  tutorial,
  onSettings,
  onRun,
  onStop,
  onReview,
}) {
  const { language, t } = useI18n();
  const scenes = project.scenes;
  const selected = scenes.slice(startScene - 1, startScene - 1 + scope);
  const analysis = project.analysis;
  const tooLong = selected.reduce((sum, scene) => sum + scene.text.length, 0) > 120000;
  return (
    <div className={`analysis-layout${analysis ? ' has-result' : ''}`}>
      <section className="panel analysis-form">
        {analysis && <h2 className="analysis-form-title">{t('Relancer une analyse')}</h2>}
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <h2>{t('Périmètre de lecture')}</h2>
            <p>{t('Les scènes sont examinées dans l’ordre du document.')}</p>
          </div>
        </div>
        <fieldset disabled={busy || tutorial}>
          <div className="settings-grid">
            <label className="field-label">
              {' '}
              {t('À partir de la scène')}{' '}
              <input
                type="number"
                min={1}
                max={scenes.length}
                value={startScene}
                onChange={(event) =>
                  onStart(Math.max(1, Math.min(scenes.length, Number(event.target.value) || 1)))
                }
              />
            </label>
            <label className="field-label">
              {' '}
              {t('Nombre de scènes')}{' '}
              <input
                type="number"
                min={1}
                max={Math.min(60, scenes.length - startScene + 1)}
                value={scope}
                onChange={(event) =>
                  onScope(
                    Math.max(
                      1,
                      Math.min(60, scenes.length - startScene + 1, Number(event.target.value) || 1),
                    ),
                  )
                }
              />
            </label>
          </div>
          <p className={`field-help ${tooLong ? 'warning-text' : ''}`}>
            {t(
              'Sélection : scènes {first} à {last} · {count} sur {total}. Jusqu’à 60 scènes et 120 000 caractères par analyse.',
              {
                first: selected[0]?.number,
                last: selected.at(-1)?.number,
                count: selected.length,
                total: scenes.length,
              },
            )}
            {tooLong && t(' Réduisez la sélection : le texte est trop long.')}
          </p>
          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <h2>{t('Moteur utilisé')}</h2>
              <p>{t('Le même moteur extrait les accessoires et examine les changements.')}</p>
            </div>
          </div>
          <div className="engine-summary">
            <div>
              <strong>
                {selection.provider === 'groq'
                  ? t('Groq · traitement distant')
                  : t('Ollama · traitement local')}
              </strong>
              <code>{selection.model || t('Modèle à choisir')}</code>
            </div>
            <button className="button secondary" onClick={onSettings}>
              {' '}
              {t('Configurer')}{' '}
            </button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => onConsent(event.target.checked)}
            />
            <span>
              {selection.provider === 'groq'
                ? t(
                    'J’autorise l’envoi des scènes sélectionnées à Groq et dispose des droits nécessaires.',
                  )
                : t('Je dispose des droits nécessaires pour traiter ces scènes en local.')}
            </span>
          </label>
          {analysis && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={replaceConsent}
                onChange={(event) => onReplaceConsent(event.target.checked)}
              />
              <span>
                {' '}
                {t(
                  'Remplacer l’analyse actuelle et ses décisions. Je peux l’exporter avant de continuer.',
                )}{' '}
              </span>
            </label>
          )}
          <button
            className="button primary full"
            disabled={
              !consent ||
              (Boolean(analysis) && !replaceConsent) ||
              !selected.length ||
              tooLong ||
              (selection.provider === 'groq' && !system?.groq)
            }
            onClick={onRun}
          >
            <Play size={17} />
            {t('Analyser {count} scènes', { count: selected.length })}
            <ArrowRight size={17} />
          </button>
        </fieldset>
        {progress && (
          <div className="analysis-progress" role="status">
            <LoaderCircle size={18} className="spin" />
            <strong>{t(progress.message)}</strong>
            <progress max={progress.total || 1} value={progress.done || 0} />
            <button className="text-button" onClick={onStop}>
              {' '}
              {t('Interrompre l’analyse')}{' '}
            </button>
          </div>
        )}
      </section>
      <div className="analysis-aside">
        <section className="panel result-summary" data-tour="analysis-result">
          <div className="section-heading">
            <CheckCircle2 size={21} />
            <h2>{analysis ? t('Résultat disponible') : t('Pas encore d’analyse')}</h2>
          </div>
          {analysis ? (
            <>
              <AnalysisWarnings analysis={analysis} />
              <div className="result-label">
                <Badge tone={analysis.recorded ? 'amber' : 'mint'}>
                  {analysis.recorded ? t('Analyse enregistrée') : t('Analyse exécutée')}
                </Badge>
                <span>
                  {new Date(analysis.completedAt).toLocaleDateString(
                    language === 'en' ? 'en-GB' : 'fr-FR',
                  )}
                </span>
              </div>
              <dl className="result-numbers">
                <div>
                  <dt>{t('Scènes analysées')}</dt>
                  <dd>
                    {analysis.analyzedSceneIds.length}
                    <span> / {scenes.length}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t('Accessoires suivis')}</dt>
                  <dd>{analysis.objects.length}</dd>
                </div>
                <div>
                  <dt>{t('Points à relire')}</dt>
                  <dd>{analysis.alerts.filter((alert) => alert.status === 'pending').length}</dd>
                </div>
              </dl>
              <div className="run-metadata">
                <code>{analysis.model}</code>
                <span>
                  {t('{calls} appels · {seconds} s · prompt {version}', {
                    calls: analysis.usage.calls,
                    seconds: (analysis.milliseconds / 1000).toLocaleString(
                      language === 'en' ? 'en-GB' : 'fr-FR',
                      { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                    ),
                    version: analysis.promptVersion,
                  })}
                </span>
              </div>
              <p className="body-note">
                {analysis.recorded
                  ? t(
                      'Ce résultat enregistré provient d’une exécution réelle. Il est consultable sans nouvel appel au modèle.',
                    )
                  : t('Ce résultat correspond à votre dernière exécution.')}
              </p>
              <button className="button primary full" onClick={onReview}>
                {' '}
                {t('Relire les résultats')} <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <p className="body-note">
              {' '}
              {t(
                'Lancez une analyse, ou ouvrez l’exemple depuis le guide pour comprendre les résultats.',
              )}{' '}
            </p>
          )}
        </section>
        <section className="plain-explanation">
          <h2>{t('Ce que l’analyse fait')}</h2>
          <ol>
            <li>
              <strong>{t('Repérer')}</strong>{' '}
              {t('les accessoires et leurs états dans le texte.')}{' '}
            </li>
            <li>
              <strong>{t('Comparer')}</strong>{' '}
              {t('les changements en recherchant les passages liés.')}{' '}
            </li>
            <li>
              <strong>{t('Signaler')}</strong>{' '}
              {t('les incompatibilités possibles avec deux citations.')}{' '}
            </li>
          </ol>
          <p>
            {' '}
            {t(
              'Une absence de mention ne prouve pas une disparition. Le modèle peut manquer une incohérence ou mal interpréter une scène.',
            )}{' '}
          </p>
        </section>
      </div>
    </div>
  );
}

export function ReviewWorkspace(props) {
  const { language, t } = useI18n();
  const { project, reviewTab, onTab, onAnalyze } = props;
  const analysis = project.analysis;
  if (!analysis)
    return (
      <section className="panel">
        <Empty
          title={t('L’analyse précède la relecture')}
          icon={Search}
          action={
            <button className="button primary" onClick={onAnalyze}>
              {' '}
              {t('Configurer l’analyse')} <ArrowRight size={17} />
            </button>
          }
        >
          {' '}
          {t(
            'Le texte est prêt. Lancez une analyse pour retrouver les accessoires et les points à vérifier.',
          )}{' '}
        </Empty>
      </section>
    );
  return (
    <>
      <AnalysisWarnings analysis={analysis} />
      {language === 'en' && (
        <p className="body-note">
          {t(
            'Les textes du scénario, les citations et les résultats enregistrés restent dans leur langue d’origine.',
          )}
        </p>
      )}
      <div className="review-summary">
        <span>
          <strong>
            {analysis.analyzedSceneIds.length} / {project.scenes.length}
          </strong>{' '}
          {t('scènes analysées')}
          {analysis.recorded ? t(' · résultat enregistré') : ''}
        </span>
        <span>
          {analysis.alerts.filter((alert) => alert.status !== 'pending').length} /{' '}
          {analysis.alerts.length} {t('points relus')}{' '}
        </span>
      </div>
      <div className="review-tabs" role="tablist" aria-label={t('Résultats de l’analyse')}>
        {[
          ['points', t('Points à vérifier'), analysis.alerts.length],
          ['objects', t('Accessoires'), analysis.objects.length],
          ['questions', t('Question au scénario'), null],
        ].map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={reviewTab === id} onClick={() => onTab(id)}>
            {t(label)}
            {count !== null && <span>{count}</span>}
          </button>
        ))}
      </div>
      {reviewTab === 'points' ? (
        <PointsReview {...props} />
      ) : reviewTab === 'objects' ? (
        <ObjectsReview project={project} onScene={props.onScene} />
      ) : (
        <Questions {...props} />
      )}
    </>
  );
}

function PointsReview({ project, activeAlert, onAlert, onDecision, onScene }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const alerts = project.analysis.alerts;
  const visible = alerts.filter((alert) => filter === 'all' || alert.status === filter);
  const selected = visible.find((alert) => alert.id === activeAlert) || visible[0];
  return (
    <>
      <div className="review-toolbar">
        <label className="compact-select">
          {' '}
          {t('Afficher')}{' '}
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{t('Tous les points ({count})', { count: alerts.length })}</option>
            {Object.entries(STATUS).map(([status, label]) => (
              <option key={status} value={status}>
                {t(label)} ({alerts.filter((alert) => alert.status === status).length})
              </option>
            ))}
          </select>
        </label>
        <p>{t('Une alerte reste une hypothèse jusqu’à votre relecture.')}</p>
      </div>
      {!selected ? (
        <section className="panel">
          <Empty
            icon={CheckCircle2}
            title={
              project.analysis.warnings?.length
                ? t('Extraction à reprendre')
                : alerts.length
                  ? t('Aucun point dans cette sélection')
                  : t('Aucun changement signalé')
            }
          >
            {project.analysis.warnings?.length
              ? t(
                  'Le modèle n’a pas fourni de preuves exploitables. Ce résultat ne permet pas de vérifier la continuité ; reprenez l’analyse avec un autre modèle.',
                )
              : alerts.length
                ? t('Changez le filtre pour retrouver les décisions déjà prises.')
                : t(
                    'Le système n’a pas signalé d’incompatibilité dans les scènes analysées. Cela ne garantit pas l’absence d’erreurs.',
                  )}
          </Empty>
        </section>
      ) : (
        <div className="review-workbench">
          <nav className="points-list" aria-label={t('Points de continuité')}>
            {visible.map((alert, index) => (
              <button
                key={alert.id}
                onClick={() => onAlert(alert.id)}
                className={selected.id === alert.id ? 'selected' : ''}
                aria-current={selected.id === alert.id ? 'true' : undefined}
              >
                <span className="point-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <Badge tone={alert.status === 'pending' ? 'amber' : 'mint'}>
                    {t(STATUS[alert.status])}
                  </Badge>
                  <strong>{alert.title}</strong>
                  <small>
                    {alert.entityName} ·{' '}
                    {alert.evidence
                      .map(
                        (item) => project.scenes.find((scene) => scene.id === item.sceneId)?.number,
                      )
                      .join(' → ')}
                  </small>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </nav>
          <PointDetail
            alert={selected}
            project={project}
            onDecision={onDecision}
            onScene={onScene}
            onNext={() =>
              onAlert(
                visible[
                  (visible.findIndex((alert) => alert.id === selected.id) + 1) % visible.length
                ].id,
              )
            }
            showNext={visible.length > 1}
          />
        </div>
      )}
    </>
  );
}

function PointDetail({ alert, project, onDecision, onScene, onNext, showNext }) {
  const { t } = useI18n();
  return (
    <article className="panel point-detail">
      <header>
        <p className="group-label">
          {alert.entityName} ·{' '}
          {alert.category === 'ownership' ? t('Possession') : t('État de l’accessoire')}
        </p>
        <h2>{alert.title}</h2>
        <p>{alert.description}</p>
      </header>
      <div className="evidence-grid" data-tour="evidence">
        {alert.evidence.map((item, index) => (
          <section className="evidence-card" key={index}>
            <div>
              <h3>{t('Passage {number}', { number: index + 1 })}</h3>
              <Badge>{stateLabel(item.state, t)}</Badge>
            </div>
            <blockquote>{item.quote}</blockquote>
            <button className="text-button" onClick={() => onScene(item.sceneId)}>
              {sourceLabel(
                project.scenes.find((scene) => scene.id === item.sceneId),
                item.page,
                t,
              )}
              <ArrowUpRight size={15} />
            </button>
          </section>
        ))}
      </div>
      <p className="review-question">
        <CircleHelp size={18} />
        {alert.question || t('Ce changement est-il intentionnel ?')}
      </p>
      <div className="review-decision" data-tour="decision">
        <label className="field-label">
          {' '}
          {t('Note pour l’équipe')}{' '}
          <textarea
            rows={3}
            value={alert.note || ''}
            onChange={(event) => onDecision(alert.id, alert.status, event.target.value, false)}
            placeholder={t('Contexte, correction à prévoir ou raison d’écarter le point…')}
            maxLength={1500}
          />
        </label>
        <p className="field-help">
          {' '}
          {t('La note est sauvegardée automatiquement. Votre décision peut être modifiée.')}{' '}
        </p>
        <p className="decision-help">
          {t(
            'Confirmer : une incohérence à corriger. Écarter : un changement expliqué ou une fausse alerte.',
          )}
        </p>
        <div className="review-actions">
          <button
            className="button secondary"
            onClick={() => onDecision(alert.id, 'dismissed', alert.note || '')}
          >
            <X size={16} /> {t('Écarter')}{' '}
          </button>
          <button
            className="button primary"
            onClick={() => onDecision(alert.id, 'confirmed', alert.note || '')}
          >
            <Check size={16} /> {t('Confirmer le point')}{' '}
          </button>
        </div>
        <div className="decision-footer">
          <span>
            {' '}
            {t('Décision :')} <strong>{t(STATUS[alert.status])}</strong>
          </span>
          {alert.status !== 'pending' && (
            <button
              className="text-button"
              onClick={() => onDecision(alert.id, 'pending', alert.note || '')}
            >
              <RotateCcw size={14} /> {t('Remettre à vérifier')}{' '}
            </button>
          )}
          {showNext && (
            <button className="text-button" onClick={onNext}>
              {' '}
              {t('Point suivant')} <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ObjectsReview({ project, onScene }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const objects = project.analysis.objects.filter((object) =>
    fold([object.name, ...object.aliases].join(' ')).includes(fold(query)),
  );
  const selected = objects.find((object) => object.id === active) || objects[0];
  return (
    <>
      <div className="review-toolbar">
        <SearchField value={query} onChange={setQuery} label={t('Rechercher un accessoire')} />
        <p>{t('Les apparitions sont classées dans l’ordre du document.')}</p>
      </div>
      {!selected ? (
        <section className="panel">
          <Empty title={t('Aucun accessoire trouvé')}>
            {' '}
            {t('Essayez un autre nom, ou vérifiez le périmètre de l’analyse.')}{' '}
          </Empty>
        </section>
      ) : (
        <div className="review-workbench">
          <nav className="objects-list panel" aria-label={t('Accessoires suivis')}>
            {objects.map((object) => (
              <button
                key={object.id}
                className={selected.id === object.id ? 'selected' : ''}
                onClick={() => setActive(object.id)}
              >
                <Package size={18} />
                <span>
                  <strong>{object.name}</strong>
                  <small>{t('{count} apparitions', { count: object.mentions.length })}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </nav>
          <article className="panel object-detail">
            <p className="group-label">{t('SUIVI D’ACCESSOIRE')}</p>
            <h2>{selected.name}</h2>
            {selected.aliases.length > 0 && (
              <p className="body-note">
                {t('Autres mentions :')} {selected.aliases.join(', ')}.
              </p>
            )}
            <ol className="object-timeline">
              {selected.mentions.map((mention, index) => (
                <li key={index}>
                  <span className="timeline-marker">
                    {project.scenes.find((scene) => scene.id === mention.sceneId)?.number}
                  </span>
                  <div>
                    <div className="timeline-state">
                      <Badge>{stateLabel(mention.state, t)}</Badge>
                      {mention.owner && mention.owner !== 'unknown' && <span>{mention.owner}</span>}
                    </div>
                    <blockquote>{mention.quote}</blockquote>
                    <button className="text-button" onClick={() => onScene(mention.sceneId)}>
                      {sourceLabel(
                        project.scenes.find((scene) => scene.id === mention.sceneId),
                        mention.page,
                        t,
                      )}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
      )}
    </>
  );
}

function Questions({
  project,
  question,
  onQuestion,
  answer,
  asking,
  onAsk,
  onScene,
  selection,
  tutorial,
}) {
  const { t } = useI18n();
  return (
    <section className="panel questions-panel">
      <div className="section-heading">
        <Search size={23} />
        <div>
          <h2>{t('Retrouver une information dans le texte')}</h2>
          <p>
            {t('Le moteur recherche les passages pertinents, puis répond avec leurs références.')}
          </p>
        </div>
      </div>
      <form onSubmit={onAsk}>
        <label className="field-label" htmlFor="question">
          {' '}
          {t('Votre question')}{' '}
        </label>
        <div className="question-form">
          <input
            id="question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder={t('Qui possède l’enveloppe rouge ?')}
            minLength={3}
            maxLength={800}
            required
          />
          <button className="button primary" disabled={asking || tutorial}>
            {asking ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
            {t('Poser la question')}{' '}
          </button>
        </div>
        <p className="field-help">
          {selection.provider === 'groq'
            ? t('Les passages retrouvés sont transmis à Groq lors de l’envoi de la question.')
            : t('Les passages retrouvés sont traités par votre modèle local.')}{' '}
          {t(
            'Recherche limitée aux {count} premières scènes. Une réponse absente du texte doit être indiquée comme introuvable.',
            { count: Math.min(60, project.scenes.length) },
          )}
        </p>
      </form>
      {answer && (
        <div className="answer-box" role="status">
          <Badge tone={answer.answer === 'NOT FOUND' ? 'amber' : 'mint'}>
            {answer.answer === 'NOT FOUND'
              ? t('Information introuvable')
              : t('Réponse avec références')}
          </Badge>
          <p>
            {answer.answer === 'NOT FOUND'
              ? t('Les passages retrouvés ne permettent pas de répondre à cette question.')
              : answer.answer}
          </p>
          {answer.answer !== 'NOT FOUND' &&
            answer.sources?.map((source) => (
              <button
                className="source-card"
                key={source.id}
                onClick={() => onScene(source.sceneId)}
              >
                <span>
                  {sourceLabel(
                    project.scenes.find((scene) => scene.id === source.sceneId),
                    undefined,
                    t,
                  )}{' '}
                  · {source.id}
                  <ArrowUpRight size={14} />
                </span>
                <q>{source.text}</q>
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

export { Evaluation } from './Evaluation.jsx';

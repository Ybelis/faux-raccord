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
const stateLabel = (state) => STATES[state] || state || 'Non précisé';

/** XML imports have scene locators, not genuine PDF page numbers. */
function sourceLabel(scene, page) {
  if (!scene) return 'Source indisponible';
  if (scene.pageIsSceneReference) return scene.sourceLocator || `Scène XML ${scene.number}`;
  return `Scène ${scene.number} · ${page ? `p. ${page}` : `p. ${scene.pages.join('–')}`}`;
}

function AnalysisWarnings({ analysis }) {
  if (!analysis?.warnings?.length) return null;
  return (
    <aside className="notice warning-notice" role="status">
      <CircleHelp size={20} />
      <div>
        {analysis.warnings.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>
    </aside>
  );
}

export function ScriptWorkspace({ project, activeScene, onScene, onReview }) {
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
              ? `${project.controlledInjectionCount} erreurs injectées`
              : project.synthetic
                ? 'Fiction synthétique'
                : 'Scénario réel'}
          </Badge>
        </div>
        <div className="document-facts">
          <span>
            <strong>{project.scenes.length}</strong> scènes
          </span>
          <span>{project.license || 'Droits à documenter'}</span>
          {project.analysis && (
            <span>
              <strong>{project.analysis.analyzedSceneIds.length}</strong> scènes analysées
            </span>
          )}
        </div>
        <details className="provenance">
          <summary>Provenance et conditions d’utilisation</summary>
          <p>{project.description || 'Document ajouté par l’utilisateur.'}</p>
          {project.sourceUrl && (
            <a href={project.sourceUrl} target="_blank" rel="noreferrer">
              Consulter la source
              <ExternalLink size={14} />
            </a>
          )}
          <p>
            Attribution : {project.author}. Licence : {project.license || 'à documenter'}.
          </p>
          {project.provenance?.rightsNotice && <p>{project.provenance.rightsNotice}</p>}
          {project.controlled && (
            <p>
              Adaptation de test : les passages ajoutés et modifiés sont artificiels. Les pages
              situent les scènes dans l’original ; le PDF original ne contient pas ces ajouts.
            </p>
          )}
          {project.scenes.some((scene) => scene.pageIsSceneReference) && (
            <p>
              Les repères proviennent des scènes XML de MovieSum. Ils ne correspondent pas aux pages
              d’un PDF original.
            </p>
          )}
          {project.warnings?.map((warning, index) => (
            <p key={index} className="warning-text">
              {warning}
            </p>
          ))}
        </details>
      </section>
      <section
        className="script-workbench panel"
        data-tour="script"
        aria-label="Lecture du scénario"
      >
        <aside className="scene-sidebar">
          <div className="scene-list-heading">
            <h2>
              Scènes <span>{project.scenes.length}</span>
            </h2>
            <SearchField value={query} onChange={setQuery} label="Chercher dans le texte" />
          </div>
          <nav className="scene-list" aria-label="Scènes du scénario">
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
                    {scene.time || 'Temps non précisé'} ·{' '}
                    {scene.pageIsSceneReference ? 'repère XML' : `p. ${scene.pages[0]}`}
                  </small>
                </span>
                {allAlerts.some((alert) =>
                  alert.evidence.some((item) => item.sceneId === scene.id),
                ) && <span className="alert-dot" />}
              </button>
            ))}
          </nav>
          {!matching.length && <p className="list-empty">Aucune scène ne contient ce texte.</p>}
        </aside>
        <article className="script-page">
          <header className="script-page-tools">
            <span>{sourceLabel(selected)}</span>
            <div>
              <button
                className="icon-button"
                aria-label="Scène précédente"
                disabled={selectedIndex === 0}
                onClick={() => onScene(project.scenes[selectedIndex - 1].id)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Scène suivante"
                disabled={selectedIndex === project.scenes.length - 1}
                onClick={() => onScene(project.scenes[selectedIndex + 1].id)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </header>
          <div className="script-paper">
            <span className="paper-label">TEXTE DU SCÉNARIO</span>
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
  const scenes = project.scenes;
  const selected = scenes.slice(startScene - 1, startScene - 1 + scope);
  const analysis = project.analysis;
  const tooLong = selected.reduce((sum, scene) => sum + scene.text.length, 0) > 120000;
  return (
    <div className="analysis-layout">
      <section className="panel analysis-form">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div>
            <h2>Périmètre de lecture</h2>
            <p>Les scènes sont examinées dans l’ordre du document.</p>
          </div>
        </div>
        <fieldset disabled={busy || tutorial}>
          <div className="settings-grid">
            <label className="field-label">
              À partir de la scène
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
              Nombre de scènes
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
            Sélection : scènes {selected[0]?.number} à {selected.at(-1)?.number} · {selected.length}{' '}
            sur {scenes.length}. Jusqu’à 60 scènes et 120 000 caractères par analyse.
            {tooLong && ' Réduisez la sélection : le texte est trop long.'}
          </p>
          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <h2>Moteur utilisé</h2>
              <p>Le même moteur extrait les accessoires et examine les changements.</p>
            </div>
          </div>
          <div className="engine-summary">
            <div>
              <strong>
                {selection.provider === 'groq'
                  ? 'Groq · traitement distant'
                  : 'Ollama · traitement local'}
              </strong>
              <code>{selection.model || 'Modèle à choisir'}</code>
            </div>
            <button className="button secondary" onClick={onSettings}>
              Configurer
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
                ? 'J’autorise l’envoi des scènes sélectionnées à Groq et dispose des droits nécessaires.'
                : 'Je dispose des droits nécessaires pour traiter ces scènes en local.'}
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
                Remplacer l’analyse actuelle et ses décisions. Je peux l’exporter avant de
                continuer.
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
            Analyser {selected.length} scènes
            <ArrowRight size={17} />
          </button>
        </fieldset>
        {progress && (
          <div className="analysis-progress" role="status">
            <LoaderCircle size={18} className="spin" />
            <strong>{progress.message}</strong>
            <progress max={progress.total || 1} value={progress.done || 0} />
            <button className="text-button" onClick={onStop}>
              Interrompre l’analyse
            </button>
          </div>
        )}
      </section>
      <div className="analysis-aside">
        <section className="panel result-summary" data-tour="analysis-result">
          <div className="section-heading">
            <CheckCircle2 size={21} />
            <h2>{analysis ? 'Résultat disponible' : 'Pas encore d’analyse'}</h2>
          </div>
          {analysis ? (
            <>
              <AnalysisWarnings analysis={analysis} />
              <div className="result-label">
                <Badge tone={analysis.recorded ? 'amber' : 'mint'}>
                  {analysis.recorded ? 'Analyse enregistrée' : 'Analyse exécutée'}
                </Badge>
                <span>{new Date(analysis.completedAt).toLocaleDateString('fr-FR')}</span>
              </div>
              <dl className="result-numbers">
                <div>
                  <dt>Scènes analysées</dt>
                  <dd>
                    {analysis.analyzedSceneIds.length}
                    <span> / {scenes.length}</span>
                  </dd>
                </div>
                <div>
                  <dt>Accessoires suivis</dt>
                  <dd>{analysis.objects.length}</dd>
                </div>
                <div>
                  <dt>Points à relire</dt>
                  <dd>{analysis.alerts.filter((alert) => alert.status === 'pending').length}</dd>
                </div>
              </dl>
              <div className="run-metadata">
                <code>{analysis.model}</code>
                <span>
                  {analysis.usage.calls} appels · {(analysis.milliseconds / 1000).toFixed(1)} s ·
                  prompt {analysis.promptVersion}
                </span>
              </div>
              <p className="body-note">
                {analysis.recorded
                  ? 'Ce résultat enregistré provient d’une exécution réelle. Il est consultable sans nouvel appel au modèle.'
                  : 'Ce résultat correspond à votre dernière exécution.'}
              </p>
              <button className="button primary full" onClick={onReview}>
                Relire les résultats
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <p className="body-note">
              Lancez une analyse, ou ouvrez l’exemple depuis le guide pour comprendre les résultats.
            </p>
          )}
        </section>
        <section className="plain-explanation">
          <h2>Ce que l’analyse fait</h2>
          <ol>
            <li>
              <strong>Repérer</strong> les accessoires et leurs états dans le texte.
            </li>
            <li>
              <strong>Comparer</strong> les changements en recherchant les passages liés.
            </li>
            <li>
              <strong>Signaler</strong> les incompatibilités possibles avec deux citations.
            </li>
          </ol>
          <p>
            Une absence de mention ne prouve pas une disparition. Le modèle peut manquer une
            incohérence ou mal interpréter une scène.
          </p>
        </section>
      </div>
    </div>
  );
}

export function ReviewWorkspace(props) {
  const { project, reviewTab, onTab, onAnalyze } = props;
  const analysis = project.analysis;
  if (!analysis)
    return (
      <section className="panel">
        <Empty
          title="L’analyse précède la relecture"
          icon={Search}
          action={
            <button className="button primary" onClick={onAnalyze}>
              Configurer l’analyse
              <ArrowRight size={17} />
            </button>
          }
        >
          Le texte est prêt. Lancez une analyse pour retrouver les accessoires et les points à
          vérifier.
        </Empty>
      </section>
    );
  return (
    <>
      <AnalysisWarnings analysis={analysis} />
      <div className="review-summary">
        <span>
          <strong>
            {analysis.analyzedSceneIds.length} / {project.scenes.length}
          </strong>{' '}
          scènes analysées{analysis.recorded ? ' · résultat enregistré' : ''}
        </span>
        <span>
          {analysis.alerts.filter((alert) => alert.status !== 'pending').length} /{' '}
          {analysis.alerts.length} points relus
        </span>
      </div>
      <div className="review-tabs" role="tablist" aria-label="Résultats de l’analyse">
        {[
          ['points', 'Points à vérifier', analysis.alerts.length],
          ['objects', 'Accessoires', analysis.objects.length],
          ['questions', 'Question au scénario', null],
        ].map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={reviewTab === id} onClick={() => onTab(id)}>
            {label}
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
  const [filter, setFilter] = useState('all');
  const alerts = project.analysis.alerts;
  const visible = alerts.filter((alert) => filter === 'all' || alert.status === filter);
  const selected = visible.find((alert) => alert.id === activeAlert) || visible[0];
  return (
    <>
      <div className="review-toolbar">
        <label className="compact-select">
          Afficher
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Tous les points ({alerts.length})</option>
            {Object.entries(STATUS).map(([status, label]) => (
              <option key={status} value={status}>
                {label} ({alerts.filter((alert) => alert.status === status).length})
              </option>
            ))}
          </select>
        </label>
        <p>Une alerte reste une hypothèse jusqu’à votre relecture.</p>
      </div>
      {!selected ? (
        <section className="panel">
          <Empty
            icon={CheckCircle2}
            title={
              project.analysis.warnings?.length
                ? 'Extraction à reprendre'
                : alerts.length
                  ? 'Aucun point dans cette sélection'
                  : 'Aucun changement signalé'
            }
          >
            {project.analysis.warnings?.length
              ? 'Le modèle n’a pas fourni de preuves exploitables. Ce résultat ne permet pas de vérifier la continuité ; reprenez l’analyse avec un autre modèle.'
              : alerts.length
                ? 'Changez le filtre pour retrouver les décisions déjà prises.'
                : 'Le système n’a pas signalé d’incompatibilité dans les scènes analysées. Cela ne garantit pas l’absence d’erreurs.'}
          </Empty>
        </section>
      ) : (
        <div className="review-workbench">
          <nav className="points-list" aria-label="Points de continuité">
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
                    {STATUS[alert.status]}
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
  return (
    <article className="panel point-detail">
      <header>
        <p className="group-label">
          {alert.entityName} ·{' '}
          {alert.category === 'ownership' ? 'Possession' : 'État de l’accessoire'}
        </p>
        <h2>{alert.title}</h2>
        <p>{alert.description}</p>
      </header>
      <div className="evidence-grid" data-tour="evidence">
        {alert.evidence.map((item, index) => (
          <section className="evidence-card" key={index}>
            <div>
              <h3>Passage {index + 1}</h3>
              <Badge>{stateLabel(item.state)}</Badge>
            </div>
            <blockquote>{item.quote}</blockquote>
            <button className="text-button" onClick={() => onScene(item.sceneId)}>
              {sourceLabel(
                project.scenes.find((scene) => scene.id === item.sceneId),
                item.page,
              )}
              <ArrowUpRight size={15} />
            </button>
          </section>
        ))}
      </div>
      <p className="review-question">
        <CircleHelp size={18} />
        {alert.question || 'Ce changement est-il intentionnel ?'}
      </p>
      <div className="review-decision" data-tour="decision">
        <label className="field-label">
          Note pour l’équipe
          <textarea
            rows={3}
            value={alert.note || ''}
            onChange={(event) => onDecision(alert.id, alert.status, event.target.value, false)}
            placeholder="Contexte, correction à prévoir ou raison d’écarter le point…"
            maxLength={1500}
          />
        </label>
        <p className="field-help">
          La note est sauvegardée automatiquement. Votre décision peut être modifiée.
        </p>
        <div className="review-actions">
          <button
            className="button secondary"
            onClick={() => onDecision(alert.id, 'dismissed', alert.note || '')}
          >
            <X size={16} />
            Écarter
          </button>
          <button
            className="button primary"
            onClick={() => onDecision(alert.id, 'confirmed', alert.note || '')}
          >
            <Check size={16} />
            Confirmer le point
          </button>
        </div>
        <div className="decision-footer">
          <span>
            Décision : <strong>{STATUS[alert.status]}</strong>
          </span>
          {alert.status !== 'pending' && (
            <button
              className="text-button"
              onClick={() => onDecision(alert.id, 'pending', alert.note || '')}
            >
              <RotateCcw size={14} />
              Remettre à vérifier
            </button>
          )}
          {showNext && (
            <button className="text-button" onClick={onNext}>
              Point suivant
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ObjectsReview({ project, onScene }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const objects = project.analysis.objects.filter((object) =>
    fold([object.name, ...object.aliases].join(' ')).includes(fold(query)),
  );
  const selected = objects.find((object) => object.id === active) || objects[0];
  return (
    <>
      <div className="review-toolbar">
        <SearchField value={query} onChange={setQuery} label="Rechercher un accessoire" />
        <p>Les apparitions sont classées dans l’ordre du document.</p>
      </div>
      {!selected ? (
        <section className="panel">
          <Empty title="Aucun accessoire trouvé">
            Essayez un autre nom, ou vérifiez le périmètre de l’analyse.
          </Empty>
        </section>
      ) : (
        <div className="review-workbench">
          <nav className="objects-list panel" aria-label="Accessoires suivis">
            {objects.map((object) => (
              <button
                key={object.id}
                className={selected.id === object.id ? 'selected' : ''}
                onClick={() => setActive(object.id)}
              >
                <Package size={18} />
                <span>
                  <strong>{object.name}</strong>
                  <small>{object.mentions.length} apparitions</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </nav>
          <article className="panel object-detail">
            <p className="group-label">SUIVI D’ACCESSOIRE</p>
            <h2>{selected.name}</h2>
            {selected.aliases.length > 0 && (
              <p className="body-note">Autres mentions : {selected.aliases.join(', ')}.</p>
            )}
            <ol className="object-timeline">
              {selected.mentions.map((mention, index) => (
                <li key={index}>
                  <span className="timeline-marker">
                    {project.scenes.find((scene) => scene.id === mention.sceneId)?.number}
                  </span>
                  <div>
                    <div className="timeline-state">
                      <Badge>{stateLabel(mention.state)}</Badge>
                      {mention.owner && mention.owner !== 'unknown' && <span>{mention.owner}</span>}
                    </div>
                    <blockquote>{mention.quote}</blockquote>
                    <button className="text-button" onClick={() => onScene(mention.sceneId)}>
                      {sourceLabel(
                        project.scenes.find((scene) => scene.id === mention.sceneId),
                        mention.page,
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
  return (
    <section className="panel questions-panel">
      <div className="section-heading">
        <Search size={23} />
        <div>
          <h2>Retrouver une information dans le texte</h2>
          <p>Le moteur recherche les passages pertinents, puis répond avec leurs références.</p>
        </div>
      </div>
      <form onSubmit={onAsk}>
        <label className="field-label" htmlFor="question">
          Votre question
        </label>
        <div className="question-form">
          <input
            id="question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder="Qui possède l’enveloppe rouge ?"
            minLength={3}
            maxLength={800}
            required
          />
          <button className="button primary" disabled={asking || tutorial}>
            {asking ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}Poser la
            question
          </button>
        </div>
        <p className="field-help">
          {selection.provider === 'groq'
            ? 'Les passages retrouvés sont transmis à Groq lors de l’envoi de la question.'
            : 'Les passages retrouvés sont traités par votre modèle local.'}{' '}
          Recherche limitée aux {Math.min(60, project.scenes.length)} premières scènes. Une réponse
          absente du texte doit être indiquée comme introuvable.
        </p>
      </form>
      {answer && (
        <div className="answer-box" role="status">
          <Badge tone={answer.answer === 'NOT FOUND' ? 'amber' : 'mint'}>
            {answer.answer === 'NOT FOUND' ? 'Information introuvable' : 'Réponse avec références'}
          </Badge>
          <p>
            {answer.answer === 'NOT FOUND'
              ? 'Les passages retrouvés ne permettent pas de répondre à cette question.'
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
                  {sourceLabel(project.scenes.find((scene) => scene.id === source.sceneId))} ·{' '}
                  {source.id}
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

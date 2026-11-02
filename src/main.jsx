import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Library,
  Languages,
  LoaderCircle,
  Play,
  Settings2,
  Sun,
  TriangleAlert,
  X,
} from 'lucide-react';
import { allProjects, saveProject, downloadFile, reportMarkdown } from './storage.js';
import { Empty } from './components/ui.jsx';
import { GuidedTour, TOUR_STEPS } from './components/GuidedTour.jsx';
import { Dialogs } from './components/Dialogs.jsx';
import { ProjectGuide } from './components/ProjectGuide.jsx';
import {
  AnalysisWorkspace,
  ScriptWorkspace,
  ReviewWorkspace,
  Evaluation,
} from './components/Workspace.jsx';
import { readModelSelection, persistModelSelection } from './model-settings.js';
import { LanguageProvider, useI18n } from './i18n-context.jsx';
import './styles.css';

const STEPS = [
  { id: 'script', label: 'Scénario', description: 'Importer et lire' },
  { id: 'analysis', label: 'Analyse', description: 'Choisir le périmètre' },
  { id: 'review', label: 'Relecture', description: 'Vérifier et décider' },
];
const THEME_LABELS = { paper: 'Papier', slate: 'Ardoise', system: 'Système' };
const safeText = (error) => error?.message || 'Une erreur est survenue.';
function preference(name, fallback) {
  try {
    return localStorage.getItem(name) || fallback;
  } catch {
    return fallback;
  }
}
async function api(path, body) {
  const response = await fetch(
    '/api/' + path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
  return data;
}

function App() {
  const { language, setLanguage, t } = useI18n();
  const [project, setProject] = useState(null);
  const [saved, setSaved] = useState([]);
  const [samples, setSamples] = useState([]);
  const [system, setSystem] = useState(null);
  const [selection, setSelection] = useState(() => readModelSelection());
  const [tab, setTab] = useState(() =>
    window.location.hash.startsWith('#/docs') ? 'docs' : 'script',
  );
  const [chapterId, setChapterId] = useState(
    () => window.location.hash.split('/')[2] || 'utiliser',
  );
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState(() => preference('fr-theme', 'system'));
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saveStatus, setSaveStatus] = useState('opening');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [startScene, setStartScene] = useState(1);
  const [scope, setScope] = useState(12);
  const [consent, setConsent] = useState(false);
  const [replaceConsent, setReplaceConsent] = useState(false);
  const [activeScene, setActiveScene] = useState(null);
  const [reviewTab, setReviewTab] = useState('points');
  const [activeAlert, setActiveAlert] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [evalReport, setEvalReport] = useState(null);
  const [tourStep, setTourStep] = useState(null);
  const tourReturn = useRef(null);
  const abort = useRef(null);
  const fileInput = useRef(null);
  const questionRequest = useRef(0);

  useEffect(() => {
    Promise.all([api('status'), api('samples'), allProjects().catch(() => [])])
      .then(async ([status, list, projects]) => {
        setSystem(status);
        setSamples(list);
        setSaved(projects);
        setSelection(readModelSelection(status));
        const latest = projects.sort((a, b) =>
          String(b.savedAt).localeCompare(String(a.savedAt)),
        )[0];
        setProject(latest || (await api('samples/valkaama')));
        if (!window.location.hash.startsWith('#/docs') && !preference('fr-introduction-seen', ''))
          setModal('welcome');
      })
      .catch((error) => setError(safeText(error)));
    api('evaluation')
      .then(setEvalReport)
      .catch(() => {});
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    function followDocumentationLink() {
      if (window.location.hash.startsWith('#/docs')) {
        setTab('docs');
        setChapterId(window.location.hash.split('/')[2] || 'utiliser');
        setModal(null);
      } else setTab((current) => (current === 'docs' ? 'script' : current));
    }
    window.addEventListener('hashchange', followDocumentationLink);
    return () => window.removeEventListener('hashchange', followDocumentationLink);
  }, []);

  useEffect(() => {
    const nextTheme = Object.hasOwn(THEME_LABELS, theme) ? theme : 'system';
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('fr-theme', nextTheme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (system) persistModelSelection(selection);
  }, [selection, system]);
  // Une autorisation de traitement local ne vaut pas accord d'envoi à Groq.
  useEffect(() => {
    setConsent(false);
  }, [selection.provider, selection.model]);
  useEffect(() => {
    // Le guide modifie une copie jetable, jamais le projet sauvegardé.
    if (!project || tourStep !== null) return;
    setSaveStatus('saving');
    const timer = setTimeout(
      () =>
        saveProject(project)
          .then(() => {
            setSaved((items) => [...items.filter((item) => item.id !== project.id), project]);
            setSaveStatus('saved');
          })
          .catch(() => {
            setSaveStatus('error');
            setError(
              'La sauvegarde locale est indisponible. Exportez votre projet pour le conserver.',
            );
          }),
      300,
    );
    return () => clearTimeout(timer);
  }, [project, tourStep]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const analysis = project?.analysis;
  const scenes = project?.scenes || [];
  const selectedScenes = scenes.slice(startScene - 1, startScene - 1 + scope);
  const pending = analysis?.alerts.filter((alert) => alert.status === 'pending').length || 0;
  const currentStep = STEPS.findIndex((step) => step.id === tab);

  function navigate(next) {
    if (next !== 'docs' && window.location.hash.startsWith('#/docs'))
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    setTab(next);
    setError('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openDocumentation(id = 'utiliser') {
    setModal(null);
    setTab('docs');
    setChapterId(id);
    window.location.hash = `/docs/${id}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function changeProject(nextProject) {
    questionRequest.current++;
    setProject(nextProject);
    navigate('script');
    setModal(null);
    setActiveScene(null);
    setActiveAlert(null);
    setReviewTab('points');
    setAnswer(null);
    setQuestion('');
    setError('');
    setConsent(false);
    setReplaceConsent(false);
    setStartScene(1);
    setScope(Math.min(12, nextProject.scenes.length));
  }
  async function openSample(id) {
    try {
      changeProject(saved.find((item) => item.id === id) || (await api('samples/' + id)));
    } catch (error) {
      setError(safeText(error));
    }
  }
  function openScene(id) {
    setActiveScene(id);
    navigate('script');
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('Le fichier dépasse 5 Mo.');
    setBusy(true);
    setError('');
    try {
      let imported;
      if (file.name.toLowerCase().endsWith('.json')) {
        const { readProjectExport } = await import('./project-import.js');
        imported = readProjectExport(await file.text());
      } else {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/import', { method: 'POST', body: form });
        imported = await response.json();
        if (!response.ok) throw new Error(imported.error);
      }
      changeProject(imported);
      setToast(
        `${imported.scenes.length} scènes disponibles. Vérifiez le découpage avant l’analyse.`,
      );
    } catch (error) {
      setError(safeText(error));
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    const projectId = project.id;
    setBusy(true);
    setError('');
    setProgress({ done: 0, total: selectedScenes.length, message: 'Connexion au moteur…' });
    abort.current = new AbortController();
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: selectedScenes, ...selection, consent, language }),
        signal: abort.current.signal,
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = '';
      // Le flux NDJSON transmet la progression entre deux appels au modèle.
      function receive(line) {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'progress') setProgress(event);
        if (event.type === 'result') {
          setProject((previous) =>
            previous.id === projectId ? { ...previous, analysis: event.result } : previous,
          );
          setActiveAlert(null);
          setReplaceConsent(false);
          setToast('Analyse terminée. Ouvrez Relecture pour vérifier les points signalés.');
        }
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(receive);
      }
      buffer += decoder.decode();
      if (buffer.trim()) receive(buffer);
    } catch (error) {
      if (error.name === 'AbortError')
        setToast('Analyse interrompue. Le résultat précédent est conservé.');
      else setError(safeText(error));
    } finally {
      setBusy(false);
      setProgress(null);
      abort.current = null;
    }
  }

  function updateAlert(id, status, note, notify = true) {
    setProject((previous) => ({
      ...previous,
      analysis: {
        ...previous.analysis,
        alerts: previous.analysis.alerts.map((alert) =>
          alert.id === id
            ? { ...alert, status, note, reviewedAt: new Date().toISOString() }
            : alert,
        ),
      },
    }));
    if (notify)
      setToast(
        tourStep !== null
          ? 'Décision enregistrée dans la copie de démonstration.'
          : 'Décision enregistrée.',
      );
  }
  async function ask(event) {
    event.preventDefault();
    if (!question.trim()) return;
    const requestId = ++questionRequest.current;
    setAsking(true);
    setError('');
    setAnswer(null);
    try {
      const result = await api('ask', {
        scenes: scenes.slice(0, 60),
        question,
        ...selection,
        language,
      });
      if (requestId === questionRequest.current) setAnswer(result);
    } catch (error) {
      if (requestId === questionRequest.current) setError(safeText(error));
    } finally {
      setAsking(false);
    }
  }
  function exportProject() {
    downloadFile(
      `${project.title}-faux-raccord.json`,
      JSON.stringify({ format: 'faux-raccord-v1', project }, null, 2),
    );
    setModal(null);
  }
  function exportReport() {
    downloadFile(
      `${project.title}-${language === 'en' ? 'report' : 'rapport'}.md`,
      reportMarkdown(project, language),
      'text/markdown',
    );
    setModal(null);
  }
  function dismissWelcome() {
    try {
      localStorage.setItem('fr-introduction-seen', 'true');
    } catch {}
    setModal(null);
  }
  async function startTour() {
    if (busy) return;
    try {
      const demo = await api('samples/les-heures-creuses');
      tourReturn.current = { project, tab, activeScene, activeAlert, reviewTab, answer, question };
      questionRequest.current++;
      setTourStep(0);
      setProject({ ...demo, id: 'tutorial-copy' });
      setTab('script');
      setToast('');
      setActiveScene(null);
      setActiveAlert(null);
      setReviewTab('points');
      setAnswer(null);
      setQuestion('');
      setAsking(false);
      setError('');
      dismissWelcome();
    } catch (error) {
      setError(safeText(error));
    }
  }
  function moveTour(step) {
    setTourStep(step);
    setTab(TOUR_STEPS[step].tab);
    setReviewTab('points');
  }
  function closeTour() {
    const previous = tourReturn.current;
    if (previous) {
      setProject(previous.project);
      setTab(previous.tab);
      setActiveScene(previous.activeScene);
      setActiveAlert(previous.activeAlert);
      setReviewTab(previous.reviewTab);
      setAnswer(previous.answer);
      setQuestion(previous.question);
    }
    tourReturn.current = null;
    setTourStep(null);
    setModal(null);
    setToast('Votre projet a été restauré. Le guide reste accessible dans le menu.');
  }

  const heading =
    tab === 'script'
      ? 'Lire le scénario'
      : tab === 'analysis'
        ? 'Analyser les accessoires'
        : tab === 'review'
          ? 'Relire la continuité'
          : 'Résultats et méthode';
  const description =
    tab === 'script'
      ? analysis
        ? 'Lisez les scènes ou ouvrez le résultat disponible pour comparer les passages signalés.'
        : 'Vérifiez le texte et le découpage des scènes avant de lancer l’analyse.'
      : tab === 'analysis'
        ? 'Sélectionnez les scènes à examiner et le moteur qui les traitera.'
        : tab === 'review'
          ? 'Comparez les passages, puis indiquez si le changement mérite une correction.'
          : 'Des résultats mesurés, avec leur périmètre et leurs limites.';

  return (
    <div className={`app-shell ${tourStep !== null ? 'tour-running' : ''}`}>
      <a className="skip-link" href="#content">
        {t('Aller au contenu')}
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('script');
          }}
          aria-label={t('Faux Raccord, accueil')}
        >
          <span className="brand-mark" aria-hidden="true">
            F<span>/</span>R
          </span>
          <span>
            Faux Raccord<small>{t('Continuité du scénario')}</small>
          </span>
        </a>
        <div className="sidebar-caption">{t('VOTRE PARCOURS')}</div>
        <nav aria-label={t('Navigation principale')}>
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              className={`nav-step ${tab === step.id ? 'active' : ''}`}
              aria-current={tab === step.id ? 'page' : undefined}
              onClick={() => navigate(step.id)}
            >
              <span className="step-number">0{index + 1}</span>
              <span>
                <strong>{t(step.label)}</strong>
                <small>{t(step.description)}</small>
              </span>
              {step.id === 'review' && pending > 0 && <span className="nav-count">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-utility" onClick={startTour} disabled={busy || tourStep !== null}>
            <Play size={17} />
            {t('Guide interactif')}
          </button>
          <button
            className="nav-utility"
            onClick={() => openDocumentation()}
            disabled={tourStep !== null}
            aria-current={tab === 'docs' ? 'page' : undefined}
          >
            <BookOpen size={17} />
            {t('Documentation')}
          </button>
          <div className="sidebar-footnote">
            {t('Analyse du texte.')}
            <br />
            {t('Décision de l’équipe.')}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="project-switch"
            onClick={() => setModal('projects')}
            disabled={busy || tourStep !== null}
          >
            <FileText size={18} />
            <span>{project?.title || t('Ouverture…')}</span>
            <ChevronDown size={16} />
          </button>
          <div className="topbar-actions">
            <span className={`save-state ${saveStatus === 'error' ? 'error' : ''}`}>
              <span className="status-dot" />
              {t(
                tourStep !== null
                  ? 'Copie de démonstration'
                  : saveStatus === 'saved'
                    ? 'Enregistré sur cet appareil'
                    : saveStatus === 'error'
                      ? 'Sauvegarde indisponible'
                      : 'Enregistrement…',
              )}
            </span>
            <label className="language-picker">
              <Languages size={16} aria-hidden="true" />
              <span className="sr-only">{t('Langue')}</span>
              <select
                aria-label={t('Langue')}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="fr" lang="fr">
                  FR
                </option>
                <option value="en" lang="en">
                  EN
                </option>
              </select>
            </label>
            <label className="theme-picker">
              <Sun size={16} />
              <span className="sr-only">{t('Thème')}</span>
              <select
                aria-label={t('Thème')}
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
              >
                {Object.entries(THEME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              onClick={() => setModal('settings')}
              aria-label={t('Réglages du moteur')}
              title={t('Réglages du moteur')}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <main id="content" tabIndex={-1}>
          {error && (
            <div className="notice error-notice" role="alert">
              <TriangleAlert size={19} />
              <span>{t(error)}</span>
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label={t('Fermer l’erreur')}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {tab === 'docs' ? (
            <ProjectGuide
              chapterId={chapterId}
              onChapter={openDocumentation}
              onEvaluation={() => navigate('evaluation')}
            />
          ) : !project ? (
            <Empty icon={LoaderCircle} title={t('Ouverture du projet')}>
              {t('Chargement du scénario et de vos dernières décisions.')}
            </Empty>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="page-index">
                    {currentStep >= 0
                      ? t('ÉTAPE {step} / 03', { step: `0${currentStep + 1}` })
                      : t('DOCUMENTATION')}
                  </p>
                  <h1>{t(heading)}</h1>
                  <p className="page-description">{t(description)}</p>
                </div>
                <div className="page-actions">
                  {tab === 'script' && (
                    <button
                      className="button secondary"
                      disabled={busy || tourStep !== null}
                      onClick={() => setModal('sources')}
                    >
                      <Library size={17} />
                      {t('Bibliothèque')}
                    </button>
                  )}
                  <button
                    className="button secondary"
                    data-tour="export"
                    onClick={() => setModal('export')}
                  >
                    <ArrowDownToLine size={17} />
                    {t('Exporter')}
                  </button>
                </div>
              </div>
              {tourStep !== null && (
                <div className="training-banner">
                  <Play size={16} />
                  <span>{t('Guide en cours · vous travaillez sur une copie de l’exemple.')}</span>
                  <button className="text-button" onClick={closeTour}>
                    {t('Quitter')}
                  </button>
                </div>
              )}
              {tab === 'script' && (
                <>
                  <ScriptWorkspace
                    key={project.id}
                    project={project}
                    activeScene={activeScene}
                    onScene={setActiveScene}
                    onAnalyze={() => navigate('analysis')}
                    onReview={(id) => {
                      setActiveAlert(id);
                      setReviewTab('points');
                      navigate('review');
                    }}
                  />
                </>
              )}
              {tab === 'analysis' && (
                <AnalysisWorkspace
                  project={project}
                  selection={selection}
                  system={system}
                  startScene={startScene}
                  scope={scope}
                  onStart={(value) => {
                    setStartScene(value);
                    setScope((current) => Math.min(current, scenes.length - value + 1));
                    setReplaceConsent(false);
                  }}
                  onScope={(value) => {
                    setScope(value);
                    setReplaceConsent(false);
                  }}
                  consent={consent}
                  onConsent={setConsent}
                  replaceConsent={replaceConsent}
                  onReplaceConsent={setReplaceConsent}
                  busy={busy}
                  progress={progress}
                  tutorial={tourStep !== null}
                  onSettings={() => setModal('settings')}
                  onRun={runAnalysis}
                  onStop={() => abort.current?.abort()}
                  onReview={() => navigate('review')}
                />
              )}
              {tab === 'review' && (
                <ReviewWorkspace
                  project={project}
                  reviewTab={reviewTab}
                  onTab={setReviewTab}
                  activeAlert={activeAlert}
                  onAlert={setActiveAlert}
                  onDecision={updateAlert}
                  onScene={openScene}
                  onAnalyze={() => navigate('analysis')}
                  question={question}
                  onQuestion={setQuestion}
                  answer={answer}
                  asking={asking}
                  onAsk={ask}
                  selection={selection}
                  tutorial={tourStep !== null}
                />
              )}
              {tab === 'evaluation' && (
                <Evaluation
                  report={evalReport}
                  analysis={analysis}
                  onOpenControlled={() => openSample('controlled-valkaama')}
                  onControlledScene={async (sceneId) => {
                    await openSample('controlled-valkaama');
                    openScene(sceneId);
                  }}
                />
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>{t('Faux Raccord · Aide à la relecture de scénarios')}</span>
            <button
              className="text-button"
              onClick={() => openDocumentation('fonctionnement')}
              disabled={tourStep !== null}
            >
              {t('Méthode et limites')}
              <ArrowRight size={14} />
            </button>
          </footer>
        </main>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.txt,.fountain,.md,.json"
        onChange={(event) => {
          importFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Dialogs
        modal={modal}
        onModal={setModal}
        project={project}
        saved={saved}
        samples={samples}
        busy={busy}
        tutorial={tourStep !== null}
        system={system}
        selection={selection}
        onSelection={setSelection}
        onSample={openSample}
        onProject={changeProject}
        onFile={() => fileInput.current.click()}
        onExportProject={exportProject}
        onExportReport={exportReport}
        onWelcomeClose={dismissWelcome}
        onTour={startTour}
      />
      {tourStep !== null && !modal && (
        <GuidedTour
          step={tourStep}
          onStep={moveTour}
          onClose={closeTour}
          decisionMade={project?.analysis?.alerts?.some((alert) => alert.status !== 'pending')}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {t(toast)}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);

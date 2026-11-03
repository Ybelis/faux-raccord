import { useI18n } from '../i18n-context.jsx';
import React from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  Library,
  Play,
  Upload,
} from 'lucide-react';
import { Badge, Modal } from './ui.jsx';
import ModelSettings from './ModelSettings.jsx';
import { SourceBrowser } from './SourceBrowser.jsx';

/** Secondary actions live in dialogs so the three-step workspace stays readable. */
export function Dialogs(props) {
  const { t, number } = useI18n();
  const {
    modal,
    onModal,
    project,
    saved,
    samples,
    busy,
    tutorial,
    system,
    selection,
    onSelection,
    onSample,
    onProject,
    onFile,
    onExportProject,
    onExportReport,
    onWelcomeClose,
    onTour,
  } = props;
  const close = () => onModal(null);
  if (modal === 'welcome')
    return (
      <Modal
        title={t('Commencer avec Faux Raccord')}
        subtitle={t(
          'L’outil aide à repérer les changements d’accessoires qui méritent une relecture dans un scénario.',
        )}
        onClose={onWelcomeClose}
      >
        <div className="continuity-example">
          <strong>{t('Une montre se brise, puis réapparaît intacte.')}</strong>
          <p>
            {t(
              'Faux Raccord retrouve les deux passages. Vous vérifiez si une réparation explique le changement, puis vous gardez ou écartez l’alerte.',
            )}
          </p>
        </div>
        <ol className="welcome-steps">
          {[
            [
              t('Lire le scénario'),
              t('Importez votre fichier ou choisissez un scénario de la bibliothèque.'),
            ],
            [t('Lancer une analyse'), t('Choisissez les scènes et le moteur Groq ou Ollama.')],
            [
              t('Relire les points signalés'),
              t('Comparez les citations, prenez une décision et exportez votre travail.'),
            ],
          ].map(([title, text], index) => (
            <li key={title}>
              <span>0{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <button className="button primary full" onClick={onTour}>
          <Play size={17} />
          {t('Essayer le guide interactif · 2 minutes')}
        </button>
        <button className="text-button welcome-skip" onClick={onWelcomeClose}>
          {t('Ouvrir directement le projet')}
          <ArrowRight size={16} />
        </button>
      </Modal>
    );
  if (modal === 'projects')
    return (
      <Modal
        title={t('Ouvrir un scénario')}
        subtitle={t(
          'Les projets sont conservés dans ce navigateur. L’export JSON permet de les partager avec le groupe.',
        )}
        onClose={close}
        wide
      >
        <div className="import-actions">
          <button className="button primary" disabled={busy} onClick={onFile}>
            <Upload size={17} />
            {t('Importer un fichier')}
          </button>
          <button className="button secondary" onClick={() => onModal('sources')}>
            <Library size={17} />
            {t('Chercher dans la bibliothèque')}
          </button>
        </div>
        <p className="field-help">
          {t('PDF avec texte, TXT, Fountain, Markdown ou projet JSON · 5 Mo maximum.')}
        </p>
        <p className="field-help">
          {t(
            'Un projet JSON est ouvert comme nouvelle copie, sans remplacer vos projets. L’import ne lance aucune analyse IA.',
          )}
        </p>
        <h3 className="group-label">{t('Exemples disponibles')}</h3>
        {samples.map((sample) => (
          <button className="project-option" key={sample.id} onClick={() => onSample(sample.id)}>
            <FileText size={21} />
            <span>
              <strong>
                {sample.title}
                <Badge tone={sample.synthetic ? 'amber' : ''}>
                  {sample.controlled
                    ? t('{count} erreurs injectées', {
                        count: number(sample.controlledInjectionCount),
                      })
                    : sample.synthetic
                      ? t('Fiction synthétique')
                      : t('Scénario réel')}
                </Badge>
              </strong>
              <small>
                {t('{count} scènes', { count: number(sample.sceneCount) })} · {sample.license}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
        {saved.filter((item) => !samples.some((sample) => sample.id === item.id)).length > 0 && (
          <>
            <h3 className="group-label">{t('Vos autres projets')}</h3>
            {saved
              .filter((item) => !samples.some((sample) => sample.id === item.id))
              .map((item) => (
                <button className="project-option" key={item.id} onClick={() => onProject(item)}>
                  <FolderOpen size={21} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {t('{count} scènes', { count: number(item.scenes.length) })} ·{' '}
                      {item.analysis ? t('Analyse disponible') : t('À analyser')}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
          </>
        )}
      </Modal>
    );
  if (modal === 'sources')
    return (
      <Modal
        title={t('Bibliothèque de scénarios')}
        subtitle={t(
          'Consultez la provenance et les conditions d’utilisation avant d’importer un document.',
        )}
        onClose={close}
        wide
      >
        <SourceBrowser onImport={onProject} />
      </Modal>
    );
  if (modal === 'settings')
    return (
      <Modal
        title={t('Réglages du moteur')}
        subtitle={t(
          'Ces réglages s’appliquent aux prochaines analyses et questions. Les résultats enregistrés conservent leur configuration d’origine.',
        )}
        onClose={close}
        wide
      >
        <fieldset disabled={busy || tutorial}>
          <ModelSettings system={system || {}} value={selection} onChange={onSelection} />
        </fieldset>
        <button className="button primary full" onClick={close}>
          {t('Revenir au projet')}
          <Check size={17} />
        </button>
      </Modal>
    );
  if (modal === 'export')
    return (
      <Modal
        title={t('Exporter le travail')}
        subtitle={t(
          'Le projet complet conserve le scénario, la provenance, les résultats et les décisions de relecture.',
        )}
        onClose={close}
      >
        <button className="project-option" onClick={onExportProject}>
          <FolderOpen size={22} />
          <span>
            <strong>{t('Projet complet · JSON')}</strong>
            <small>{t('À partager puis réimporter dans Faux Raccord.')}</small>
          </span>
          <ArrowDownToLine size={18} />
        </button>
        <button className="project-option" onClick={onExportReport}>
          <FileText size={22} />
          <span>
            <strong>{t('Rapport de continuité · Markdown')}</strong>
            <small>{t('Les points signalés, leurs citations et vos décisions.')}</small>
          </span>
          <ArrowDownToLine size={18} />
        </button>
        <p className="body-note">
          {t(
            'L’export contient le texte du scénario. Ses conditions de redistribution restent applicables.',
          )}
        </p>
      </Modal>
    );
  return null;
}

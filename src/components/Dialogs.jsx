import React from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
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
    onEvaluation,
  } = props;
  const close = () => onModal(null);
  if (modal === 'welcome')
    return (
      <Modal
        title="Commencer avec Faux Raccord"
        subtitle="L’outil aide à repérer les changements d’accessoires qui méritent une relecture dans un scénario."
        onClose={onWelcomeClose}
      >
        <ol className="welcome-steps">
          {[
            [
              'Lire le scénario',
              'Importez votre fichier ou choisissez un scénario de la bibliothèque.',
            ],
            ['Lancer une analyse', 'Choisissez les scènes et le moteur Groq ou Ollama.'],
            [
              'Relire les points signalés',
              'Comparez les citations, prenez une décision et exportez votre travail.',
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
          Essayer le guide interactif · 2 minutes
        </button>
        <button className="text-button welcome-skip" onClick={onWelcomeClose}>
          Ouvrir directement le projet
          <ArrowRight size={16} />
        </button>
      </Modal>
    );
  if (modal === 'projects')
    return (
      <Modal
        title="Ouvrir un scénario"
        subtitle="Les projets sont conservés dans ce navigateur. L’export JSON permet de les partager avec le groupe."
        onClose={close}
        wide
      >
        <div className="import-actions">
          <button className="button primary" disabled={busy} onClick={onFile}>
            <Upload size={17} />
            Importer un fichier
          </button>
          <button className="button secondary" onClick={() => onModal('sources')}>
            <Library size={17} />
            Chercher dans la bibliothèque
          </button>
        </div>
        <p className="field-help">
          PDF avec texte, TXT, Fountain, Markdown ou projet JSON · 5 Mo maximum.
        </p>
        <h3 className="group-label">Exemples disponibles</h3>
        {samples.map((sample) => (
          <button className="project-option" key={sample.id} onClick={() => onSample(sample.id)}>
            <FileText size={21} />
            <span>
              <strong>
                {sample.title}
                <Badge tone={sample.synthetic ? 'amber' : ''}>
                  {sample.synthetic ? 'Fiction synthétique' : 'Scénario réel'}
                </Badge>
              </strong>
              <small>
                {sample.sceneCount} scènes · {sample.license}
              </small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
        {saved.filter((item) => !samples.some((sample) => sample.id === item.id)).length > 0 && (
          <>
            <h3 className="group-label">Vos autres projets</h3>
            {saved
              .filter((item) => !samples.some((sample) => sample.id === item.id))
              .map((item) => (
                <button className="project-option" key={item.id} onClick={() => onProject(item)}>
                  <FolderOpen size={21} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.scenes.length} scènes ·{' '}
                      {item.analysis ? 'Analyse disponible' : 'À analyser'}
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
        title="Bibliothèque de scénarios"
        subtitle="Consultez la provenance et les conditions d’utilisation avant d’importer un document."
        onClose={close}
        wide
      >
        <SourceBrowser onImport={onProject} />
      </Modal>
    );
  if (modal === 'settings')
    return (
      <Modal
        title="Réglages du moteur"
        subtitle="Ces réglages s’appliquent aux prochaines analyses et questions. Les résultats enregistrés conservent leur configuration d’origine."
        onClose={close}
        wide
      >
        <fieldset disabled={busy || tutorial}>
          <ModelSettings system={system || {}} value={selection} onChange={onSelection} />
        </fieldset>
        <button className="button primary full" onClick={close}>
          Revenir au projet
          <Check size={17} />
        </button>
      </Modal>
    );
  if (modal === 'export')
    return (
      <Modal
        title="Exporter le travail"
        subtitle="Le projet complet conserve le scénario, la provenance, les résultats et les décisions de relecture."
        onClose={close}
      >
        <button className="project-option" onClick={onExportProject}>
          <FolderOpen size={22} />
          <span>
            <strong>Projet complet · JSON</strong>
            <small>À partager puis réimporter dans Faux Raccord.</small>
          </span>
          <ArrowDownToLine size={18} />
        </button>
        <button className="project-option" onClick={onExportReport}>
          <FileText size={22} />
          <span>
            <strong>Rapport de continuité · Markdown</strong>
            <small>Les points signalés, leurs citations et vos décisions.</small>
          </span>
          <ArrowDownToLine size={18} />
        </button>
        <p className="body-note">
          L’export contient le texte du scénario. Ses conditions de redistribution restent
          applicables.
        </p>
      </Modal>
    );
  if (modal === 'documentation')
    return (
      <Modal
        title="Méthode et limites"
        subtitle="Faux Raccord examine le texte d’un scénario. Il ne vérifie pas les images d’un film."
        onClose={close}
        wide
      >
        <div className="documentation-copy">
          <h3>Comment lire un résultat</h3>
          <p>
            Un point signalé est une hypothèse à relire. Les citations existent dans le texte, mais
            cela ne garantit pas que leur interprétation est correcte. Confirmer ou écarter un point
            enregistre la décision de votre équipe.
          </p>
          <h3>Ce qui est couvert</h3>
          <p>
            Les états et la possession d’accessoires explicitement mentionnés, dans les scènes
            sélectionnées. Les accessoires non extraits, les ellipses et les changements de
            chronologie peuvent produire des erreurs.
          </p>
          <h3>Conservation et confidentialité</h3>
          <p>
            Les projets sont conservés sur cet appareil, sans synchronisation entre membres. Groq
            reçoit les scènes de l’analyse et les passages recherchés pour une question. Ollama
            permet un traitement local lorsque le projet tourne sur votre ordinateur.
          </p>
          <h3>Pour préparer la soutenance</h3>
          <p>
            Le dépôt contient le README, les diagrammes d’architecture, le parcours du code, la
            matrice des exigences du cours et les réponses aux principales limites. Les entretiens
            utilisateur et la relecture des annotations restent à réaliser par le groupe.
          </p>
        </div>
        <button className="button secondary full" onClick={onEvaluation}>
          Consulter les résultats d’évaluation
          <ArrowRight size={17} />
        </button>
        <button className="text-button welcome-skip" onClick={onTour} disabled={busy || tutorial}>
          <Play size={16} />
          Revoir le guide interactif
        </button>
      </Modal>
    );
  return null;
}

import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

export const TOUR_STEPS = [
  {
    tab: 'script',
    target: 'script',
    title: '1. Partir du texte',
    text: 'Voici Les Heures Creuses, un exemple fictif de 12 scènes. Choisissez une scène dans la liste pour lire son texte. Ce guide utilise une copie séparée : votre projet reste intact.',
  },
  {
    tab: 'analysis',
    target: 'analysis-result',
    title: '2. Comprendre le résultat',
    text: 'Une analyse de cet exemple a déjà été exécutée. Elle extrait les accessoires, suit leurs états et compare les changements. Le nombre de scènes analysées indique exactement ce qui a été couvert.',
  },
  {
    tab: 'review',
    target: 'evidence',
    title: '3. Comparer les passages',
    text: 'Chaque point rapproche deux citations du scénario. Lisez-les : un changement peut être voulu. Le lien sous chaque citation permet de retrouver la scène complète.',
  },
  {
    tab: 'review',
    target: 'decision',
    title: '4. Prendre une décision',
    text: 'Ajoutez une note si nécessaire, puis confirmez ou écartez ce point. Cela enregistre votre avis ; le modèle ne décide pas à votre place.',
    requiresDecision: true,
  },
  {
    tab: 'review',
    target: 'export',
    title: '5. Conserver le travail',
    text: 'Le projet est sauvegardé dans ce navigateur. Le bouton Exporter permet de transmettre le projet complet en JSON ou un rapport lisible. Vous pouvez maintenant revenir à votre scénario.',
  },
];

/** The guide annotates the real workspace; its parent owns a disposable demo. */
export function GuidedTour({ step, onStep, onClose, decisionMade }) {
  const heading = useRef(null);
  const current = TOUR_STEPS[step];
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const target = document.querySelector(`[data-tour="${current.target}"]`);
    target?.setAttribute('data-tour-active', 'true');
    const timer = setTimeout(
      () => target?.scrollIntoView({ block: 'nearest', behavior: 'instant' }),
      100,
    );
    return () => {
      clearTimeout(timer);
      target?.removeAttribute('data-tour-active');
    };
  }, [step]);
  const blocked = current.requiresDecision && !decisionMade;
  return (
    <aside className="tour-card" aria-label="Guide interactif">
      <div className="tour-heading">
        <span>
          PRISE EN MAIN · {step + 1} / {TOUR_STEPS.length}
        </span>
        <button className="icon-button" onClick={onClose} aria-label="Quitter le guide">
          <X size={18} />
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {current.title}
      </h2>
      <p>{current.text}</p>
      {blocked && (
        <p className="tour-instruction">
          Pour continuer, choisissez « Confirmer le point » ou « Écarter ».
        </p>
      )}
      <div className="tour-actions">
        <button className="text-button" disabled={step === 0} onClick={() => onStep(step - 1)}>
          <ArrowLeft size={16} />
          Précédent
        </button>
        <button
          className="button primary"
          disabled={blocked}
          onClick={() => (step === TOUR_STEPS.length - 1 ? onClose() : onStep(step + 1))}
        >
          {step === TOUR_STEPS.length - 1 ? 'Revenir à mon projet' : 'Suivant'}
          {step === TOUR_STEPS.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}
        </button>
      </div>
    </aside>
  );
}

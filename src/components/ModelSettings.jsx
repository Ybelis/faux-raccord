import { useI18n } from '../i18n-context.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Server,
  Cloud,
  TriangleAlert,
} from 'lucide-react';
import {
  defaultModelSelection,
  persistModelSelection,
  readProviderSelection,
} from '../model-settings.js';

async function request(path, body, signal) {
  const response = await fetch(path, {
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Le serveur ne répond pas.');
  return result;
}

/** Controlled settings form. value = { provider, model, settings }; onChange receives that shape. */
export default function ModelSettings({ system = {}, value, onChange }) {
  const { t, number } = useI18n();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState(null);
  const [reload, setReload] = useState(0);
  const verificationController = useRef(null);
  const selection = value || defaultModelSelection(system);
  const { provider, model, settings } = selection;
  const available = provider === 'groq' ? system.groq : system.ollama;
  const supportsReasoning = provider === 'groq' && model.includes('gpt-oss');
  const currentModel = catalog.find((item) => item.id === model);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog([]);
    setError('');
    if (!available) return () => controller.abort();
    setLoading(true);
    request(`/api/models?provider=${provider}`, undefined, controller.signal)
      .then((result) => setCatalog(result.models))
      .catch((problem) => {
        if (!controller.signal.aborted) setError(problem.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [provider, available, reload]);

  useEffect(() => {
    verificationController.current?.abort();
    setChecking(false);
    setVerification(null);
    return () => verificationController.current?.abort();
  }, [provider, model, JSON.stringify(settings)]);

  function update(next) {
    persistModelSelection(next);
    onChange(next);
  }

  function changeSetting(name, nextValue) {
    update({ ...selection, settings: { ...settings, [name]: nextValue } });
  }

  async function verify() {
    const controller = new AbortController();
    verificationController.current = controller;
    setChecking(true);
    setVerification(null);
    setError('');
    try {
      setVerification(await request('/api/models/check', selection, controller.signal));
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem.message);
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }

  return (
    <div className="model-settings">
      <fieldset className="settings-fieldset">
        <legend>{t('Où exécuter l’analyse ?')}</legend>
        <div className="provider-options" role="group" aria-label={t('Fournisseur du modèle')}>
          <button
            type="button"
            className={provider === 'groq' ? 'active' : ''}
            aria-pressed={provider === 'groq'}
            onClick={() => update(readProviderSelection('groq', system))}
          >
            <Cloud size={21} />
            <span>
              <strong>Groq</strong>
              <small>{t('API distante · clé sur le serveur')}</small>
            </span>
          </button>
          <button
            type="button"
            className={provider === 'ollama' ? 'active' : ''}
            aria-pressed={provider === 'ollama'}
            disabled={!system.ollama}
            onClick={() => update(readProviderSelection('ollama', system))}
          >
            <Server size={21} />
            <span>
              <strong>Ollama</strong>
              <small>
                {system.ollama
                  ? t('Modèles installés sur votre machine')
                  : t('Disponible avec le lancement local')}
              </small>
            </span>
          </button>
        </div>
        <p className="field-help">
          {provider === 'groq'
            ? t(
                'Les scènes sélectionnées sont envoyées à Groq lors de l’analyse. Le catalogue ne reçoit aucun texte du scénario.',
              )
            : t(
                'Le serveur contacte votre installation Ollama. Aucun scénario n’est envoyé à Groq.',
              )}
        </p>
      </fieldset>

      {!available && (
        <p className="settings-notice">
          <TriangleAlert size={17} />
          {provider === 'groq'
            ? t('Ajoutez GROQ_API_KEY au fichier .env du serveur, puis redémarrez le projet.')
            : t('Lancez le projet sur votre ordinateur pour utiliser Ollama.')}
        </p>
      )}

      <fieldset className="settings-fieldset">
        <legend>{t('Modèle')}</legend>
        <div className="model-catalog-controls">
          <label className="field-label" htmlFor="model-catalog">
            {provider === 'groq' ? t('Modèles du catalogue Groq') : t('Modèles installés')}
            <select
              id="model-catalog"
              value={catalog.some((item) => item.id === model) ? model : ''}
              onChange={(event) =>
                event.target.value && update({ ...selection, model: event.target.value })
              }
              disabled={loading || !catalog.length}
            >
              <option value="">
                {loading
                  ? t('Chargement du catalogue…')
                  : catalog.length
                    ? t('Choisir un modèle')
                    : t('Aucun modèle chargé')}
              </option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                  {item.parameters ? ` · ${item.parameters}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button secondary"
            aria-label={t('Actualiser les modèles')}
            disabled={loading || !available}
            onClick={() => setReload(reload + 1)}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            <span>{t('Actualiser')}</span>
          </button>
        </div>
        <label className="field-label" htmlFor="model-identifier">
          {t('Identifiant du modèle')}
          <input
            id="model-identifier"
            value={model}
            maxLength={100}
            spellCheck="false"
            onChange={(event) => update({ ...selection, model: event.target.value })}
          />
        </label>
        <p className="field-help">
          {t(
            'Vous pouvez saisir un identifiant absent de la liste. Le test ci-dessous vérifie la connexion et une réponse JSON ; il ne garantit pas la qualité de l’analyse.',
          )}
        </p>
        {provider === 'ollama' && (
          <p className="field-help">
            {t(
              'La liste reflète les modèles installés sur le serveur. Elle ne constitue pas une sélection validée pour l’extraction d’accessoires. Consultez les profils et leurs limites dans Documentation → Données et fonctionnement.',
            )}
          </p>
        )}
        {currentModel && (
          <p className="model-metadata">
            {currentModel.owner && (
              <span>
                {t('Éditeur :')} {currentModel.owner}
              </span>
            )}
            {currentModel.contextWindow && (
              <span>
                {t('Contexte annoncé :')} {number(currentModel.contextWindow)} tokens
              </span>
            )}
            {currentModel.parameters && (
              <span>
                {t('Paramètres :')} {currentModel.parameters}
              </span>
            )}
            {currentModel.quantization && (
              <span>
                {t('Quantification :')} {currentModel.quantization}
              </span>
            )}
            {currentModel.sizeBytes && (
              <span>
                {t('Poids :')}{' '}
                {number(currentModel.sizeBytes / 1e9, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                {t('Go')}
              </span>
            )}
          </p>
        )}
      </fieldset>

      <details className="advanced-settings">
        <summary>{t('Réglages avancés')}</summary>
        <p className="field-help">
          {t(
            'Les réglages effectifs accompagnent chaque analyse. Les scores enregistrés concernent uniquement le modèle, les paramètres et le profil indiqués dans leur rapport.',
          )}
        </p>
        <div className="settings-grid">
          <label className="field-label" htmlFor="model-temperature">
            {t('Température')}
            <select
              id="model-temperature"
              value={settings.temperature}
              onChange={(event) => changeSetting('temperature', Number(event.target.value))}
            >
              <option value={0}>{t('0 · par défaut')}</option>
              <option value={0.1}>{number(0.1)}</option>
              <option value={0.3}>{number(0.3)}</option>
              <option value={0.5}>{number(0.5)}</option>
              <option value={1}>1</option>
            </select>
            <span className="field-help">
              {t('0 réduit la variation des réponses, sans assurer un résultat identique.')}
            </span>
          </label>
          <label className="field-label" htmlFor="model-output-budget">
            {t('Sortie maximale par appel')}
            <select
              id="model-output-budget"
              value={settings.maxOutputTokens}
              onChange={(event) => changeSetting('maxOutputTokens', Number(event.target.value))}
            >
              {[1024, 2500, 3000, 5000, 8000, 12000, 16000].map((count) => (
                <option key={count} value={count}>
                  {number(count)} tokens{count === 5000 ? t(' · par défaut') : ''}
                </option>
              ))}
            </select>
            <span className="field-help">
              {provider === 'groq'
                ? t(
                    'L’analyse Groq borne l’extraction à 3 000 tokens et la comparaison à 1 000, par groupes de deux candidats. Une limite plus basse reste appliquée.',
                  )
                : t(
                    'Une limite basse peut couper le JSON. La comparaison et les questions gardent des plafonds plus courts.',
                  )}
            </span>
          </label>
          {supportsReasoning && (
            <label className="field-label" htmlFor="model-reasoning">
              {t('Effort de raisonnement')}
              <select
                id="model-reasoning"
                value={settings.reasoningEffort}
                onChange={(event) => changeSetting('reasoningEffort', event.target.value)}
              >
                <option value="low">{t('Faible · par défaut')}</option>
                <option value="medium">{t('Moyen')}</option>
                <option value="high">{t('Élevé')}</option>
              </select>
              <span className="field-help">
                {t(
                  'GPT-OSS uniquement. Un effort plus élevé peut augmenter les tokens et le temps d’attente.',
                )}
              </span>
            </label>
          )}
          {provider === 'ollama' && (
            <label className="field-label" htmlFor="model-context">
              {t('Contexte Ollama')}
              <select
                id="model-context"
                value={settings.contextWindow}
                onChange={(event) => changeSetting('contextWindow', Number(event.target.value))}
              >
                {[4096, 8192, 16384, 32768, 65536, 131072].map((count) => (
                  <option key={count} value={count}>
                    {number(count)} tokens
                    {count === 16384 ? t(' · par défaut') : ''}
                  </option>
                ))}
              </select>
              <span className="field-help">
                {t(
                  'Doit tenir dans la mémoire disponible et respecter les capacités du modèle. Un contexte trop court peut tronquer les scènes.',
                )}
              </span>
            </label>
          )}
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            update({ ...selection, settings: defaultModelSelection(system, provider).settings })
          }
        >
          <RotateCcw size={15} />
          {t('Rétablir les réglages par défaut')}
        </button>
      </details>

      <div className="model-verification">
        <button
          type="button"
          className="button secondary"
          onClick={verify}
          disabled={
            checking ||
            !available ||
            !/^[a-zA-Z0-9._:/-]{1,100}$/.test(model) ||
            model.includes('..')
          }
        >
          {checking ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}{' '}
          {checking ? t('Vérification en cours…') : t('Tester la connexion et le JSON')}
        </button>
        <p className="field-help">
          {t(
            'Ce bouton envoie une courte requête au modèle. Sur Groq, elle compte dans votre quota. Aucun passage du scénario n’est transmis.',
          )}
        </p>
        {verification && (
          <p className="settings-success" role="status">
            <CheckCircle2 size={17} />
            <span>
              {t(
                'Réponse JSON vérifiée en {seconds} s · {tokens} tokens. La qualité de l’analyse reste à évaluer.',
                {
                  seconds: number(verification.usage.milliseconds / 1000, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                  tokens: number(verification.usage.inputTokens + verification.usage.outputTokens),
                },
              )}
            </span>
          </p>
        )}
        {error && (
          <p className="settings-error" role="alert">
            <TriangleAlert size={17} />
            {t(error)}
          </p>
        )}
      </div>
    </div>
  );
}

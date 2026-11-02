import { DEFAULT_MODEL_SETTINGS, validateModelSettings } from './core/model.js';

const STORAGE_KEY = 'faux-raccord:model-selection:v1';
const VALID_NAME = /^[a-zA-Z0-9._:/-]{1,100}$/;

export function defaultModelSelection(system = {}, provider = 'groq') {
  return {
    provider,
    model:
      provider === 'ollama'
        ? system.ollamaModel || 'qwen3:1.7b'
        : system.model || 'openai/gpt-oss-20b',
    settings: { ...DEFAULT_MODEL_SETTINGS },
  };
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function readProviderSelection(provider, system = {}) {
  const defaults = defaultModelSelection(system, provider);
  const saved = readSaved().providers?.[provider];
  if (
    !saved ||
    typeof saved.model !== 'string' ||
    !VALID_NAME.test(saved.model) ||
    saved.model.includes('..')
  )
    return defaults;
  try {
    return { provider, model: saved.model, settings: validateModelSettings(saved.settings) };
  } catch {
    return defaults;
  }
}

export function readModelSelection(system = {}) {
  const provider = readSaved().provider === 'ollama' && system.ollama ? 'ollama' : 'groq';
  return readProviderSelection(provider, system);
}

// Each provider retains its own model and parameters. API keys are never accepted here.
export function persistModelSelection(selection) {
  if (!['groq', 'ollama'].includes(selection.provider)) return;
  try {
    const saved = readSaved();
    const safe = { model: selection.model, settings: validateModelSettings(selection.settings) };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        provider: selection.provider,
        providers: { ...saved.providers, [selection.provider]: safe },
      }),
    );
  } catch {
    /* Storage may be blocked; the current session can still use the settings. */
  }
}

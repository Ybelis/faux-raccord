import { PROMPT_VERSION } from './prompts.js';
export class ModelError extends Error {
  constructor(message, status = 502, code = 'MODEL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const DEFAULT_MODEL_SETTINGS = Object.freeze({
  temperature: 0,
  maxOutputTokens: 5000,
  reasoningEffort: 'low',
  contextWindow: 16384,
});

// Bounds limit accidental resource use, without promising that each model
// supports the maximum. The explicit JSON test checks provider compatibility.
export function validateModelSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ModelError('Les réglages du modèle sont invalides.', 400);
  const settings = { ...DEFAULT_MODEL_SETTINGS };
  for (const [key, min, max, integer] of [
    ['temperature', 0, 1, false],
    ['maxOutputTokens', 256, 16000, true],
    ['contextWindow', 4096, 131072, true],
  ]) {
    if (input[key] === undefined) continue;
    const value = input[key];
    const outOfRange =
      typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max;
    if (outOfRange || (integer && !Number.isInteger(value)))
      throw new ModelError(`Réglage invalide : ${key}.`, 400);
    settings[key] = input[key];
  }
  if (input.reasoningEffort !== undefined) {
    if (!['low', 'medium', 'high'].includes(input.reasoningEffort))
      throw new ModelError('Niveau de raisonnement invalide.', 400);
    settings.reasoningEffort = input.reasoningEffort;
  }
  return settings;
}

export function modelConfig(env = {}, provider = 'groq', model, settings) {
  if (!['groq', 'ollama'].includes(provider)) throw new ModelError('Fournisseur inconnu.', 400);
  if (provider === 'groq' && !env.GROQ_API_KEY)
    throw new ModelError(
      'Configurez GROQ_API_KEY dans le fichier .env du serveur.',
      503,
      'MISSING_KEY',
    );
  if (provider === 'ollama' && !env.LOCAL_MODE)
    throw new ModelError('Ollama est disponible avec le lancement local du projet.', 400);
  const name =
    model ||
    (provider === 'groq'
      ? env.GROQ_MODEL || 'openai/gpt-oss-20b'
      : env.OLLAMA_MODEL || 'qwen3:1.7b');
  if (typeof name !== 'string' || !/^[a-zA-Z0-9._:/-]{1,100}$/.test(name) || name.includes('..'))
    throw new ModelError('Nom du modèle invalide.', 400);
  // Requests cannot supply an endpoint or key. Ollama's address belongs to
  // the trusted server configuration; hosted execution cannot access it.
  const ollamaUrl = (env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  return {
    provider,
    model: name,
    baseUrl:
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : `${ollamaUrl}/api/chat`,
    key: provider === 'groq' ? env.GROQ_API_KEY : undefined,
    settings: validateModelSettings(settings),
  };
}

function isOllamaEmbedding(item, id) {
  const name = id.split('/').at(-1).split(':')[0];
  const embeddingName =
    /(?:^|[-_.])embed(?:ding|dings)?(?:[-_.]|$)|^(?:bge|all-minilm|embeddinggemma)(?:[-_.]|$)/i.test(
      name,
    );
  const families = [
    item.details?.family,
    ...(Array.isArray(item.details?.families) ? item.details.families : []),
  ]
    .filter((family) => typeof family === 'string')
    .map((family) => family.toLowerCase());
  const embeddingFamilies = new Set(['bert', 'nomic-bert', 'jina-bert', 'jina-bert-v2']);
  // Les tags ne certifient pas les capacités : on retire seulement les noms
  // d'embeddings explicites ou les familles d'encodeurs connues. Un modèle
  // inconnu reste proposé et doit passer le test JSON avant utilisation.
  return (
    embeddingName ||
    (families.length > 0 && families.every((family) => embeddingFamilies.has(family)))
  );
}

function catalogItem(item, provider) {
  if (!item || typeof item !== 'object') return null;
  const id = provider === 'groq' ? item.id : item.name || item.model;
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9._:/-]{1,100}$/.test(id) ||
    id.includes('..') ||
    item.active === false
  )
    return null;
  // Groq's general catalogue also contains non-chat endpoints such as Whisper.
  if (provider === 'groq' && /whisper|tts|guard|orpheus|embed|compound/i.test(id)) return null;
  if (provider === 'ollama' && isOllamaEmbedding(item, id)) return null;
  if (provider === 'groq') {
    return {
      id,
      owner: typeof item.owned_by === 'string' ? item.owned_by.slice(0, 100) : undefined,
      contextWindow: Number.isFinite(item.context_window) ? item.context_window : undefined,
    };
  }
  return {
    id,
    sizeBytes: Number.isFinite(item.size) ? item.size : undefined,
    parameters:
      typeof item.details?.parameter_size === 'string'
        ? item.details.parameter_size.slice(0, 30)
        : undefined,
    quantization:
      typeof item.details?.quantization_level === 'string'
        ? item.details.quantization_level.slice(0, 30)
        : undefined,
  };
}

// Only selected provider metadata is exposed. Credentials stay server-side.
export async function listModels(env, provider, { fetcher = fetch } = {}) {
  const config = modelConfig(env, provider);
  const endpoint =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/models'
      : config.baseUrl.replace(/\/api\/chat$/, '/api/tags');
  let response;
  try {
    response = await fetcher(endpoint, {
      headers: provider === 'groq' ? { Authorization: `Bearer ${config.key}` } : {},
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    const message =
      provider === 'ollama'
        ? 'Ollama est inaccessible. Démarrez Ollama sur le serveur local, puis actualisez la liste.'
        : 'Le catalogue Groq est inaccessible. Réessayez ou saisissez un identifiant de modèle.';
    throw new ModelError(message, 503, 'CATALOG_UNREACHABLE');
  }
  if (!response.ok)
    throw new ModelError(
      response.status === 401
        ? 'La clé Groq est refusée.'
        : 'Le catalogue de modèles est temporairement indisponible.',
      response.status === 401 ? 401 : 503,
      'CATALOG_ERROR',
    );
  const data = await response.json();
  const entries = provider === 'groq' ? data.data : data.models;
  const models = (Array.isArray(entries) ? entries : [])
    .map((item) => catalogItem(item, provider))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    provider,
    models,
    defaultModel: config.model,
    checkedAt: new Date().toISOString(),
    compatibility:
      'La présence dans le catalogue ne garantit pas la qualité de l’extraction. Testez le JSON avant une analyse.',
  };
}

export function parseModelJSON(content) {
  const text = String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')
    .trim();
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new ModelError(
      'Le modèle a renvoyé un JSON invalide. Relancez l’analyse.',
      502,
      'INVALID_JSON',
    );
  }
}

function completionBody(config, settings, messages, outputLimit) {
  if (config.provider === 'ollama') {
    return {
      model: config.model,
      messages,
      format: 'json',
      stream: false,
      think: false,
      options: {
        temperature: settings.temperature,
        num_predict: outputLimit,
        num_ctx: settings.contextWindow,
      },
    };
  }
  return {
    model: config.model,
    messages,
    temperature: settings.temperature,
    max_completion_tokens: outputLimit,
    response_format: { type: 'json_object' },
    // Other Groq models reject this provider-specific parameter.
    ...(config.model.includes('gpt-oss') ? { reasoning_effort: settings.reasoningEffort } : {}),
  };
}

function providerError(status, result) {
  const code = String(result.error?.code || result.error?.type || 'inconnu')
    .replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED]')
    .slice(0, 80);
  const message =
    status === 401
      ? 'La clé Groq est refusée.'
      : status === 429
        ? 'Limite Groq atteinte. Réessayez dans une minute ou utilisez Ollama.'
        : `Le fournisseur a refusé la requête (${status}, ${code}).`;
  const error = new ModelError(
    message,
    status === 401 ? 401 : 502,
    status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR',
  );
  error.details = String(result.error?.message || '')
    .replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED]')
    .slice(0, 450);
  return error;
}

async function waitForRetry(response, attempt, signal) {
  const seconds = Number(response.headers.get('retry-after') || 0);
  const wait = Math.min(
    30000,
    Math.max(2000 * (attempt + 1), Number.isFinite(seconds) ? seconds * 1000 : 0),
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(finish, wait);
    function finish() {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }
    function cancel() {
      clearTimeout(timer);
      reject(new ModelError('Analyse interrompue.', 502, 'MODEL_UNREACHABLE'));
    }
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
  });
}

export async function callModel(
  config,
  system,
  user,
  { maxTokens, signal, fetcher = fetch, retries = 2 } = {},
) {
  const start = Date.now();
  const settings = validateModelSettings(config.settings);
  // A stage can impose a smaller ceiling; extraction uses the selected budget.
  const outputLimit =
    maxTokens === undefined
      ? settings.maxOutputTokens
      : Math.min(maxTokens, settings.maxOutputTokens);
  const messages = [
    { role: 'system', content: 'Réponds exclusivement en JSON valide.\n' + system },
    { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) },
  ];
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      const timeout = AbortSignal.timeout(180000);
      response = await fetcher(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.provider === 'groq' ? { Authorization: `Bearer ${config.key}` } : {}),
        },
        body: JSON.stringify(completionBody(config, settings, messages, outputLimit)),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      throw new ModelError(
        signal?.aborted
          ? 'Analyse interrompue.'
          : 'Le moteur IA ne répond pas. Vérifiez sa connexion.',
        502,
        'MODEL_UNREACHABLE',
      );
    }
    if ([429, 500, 502, 503].includes(response.status) && attempt < retries) {
      await waitForRetry(response, attempt, signal);
      continue;
    }
    const result = await response.json().catch(() => ({}));
    if (
      response.status === 400 &&
      result.error?.code === 'json_validate_failed' &&
      attempt < retries
    ) {
      messages.push({
        role: 'user',
        content:
          'Réponds avec un objet JSON valide uniquement. Toutes les chaînes doivent être correctement échappées. Respecte exactement les clés et identifiants demandés.',
      });
      continue;
    }
    if (!response.ok) throw providerError(response.status, result);
    const data = parseModelJSON(
      config.provider === 'groq' ? result.choices?.[0]?.message?.content : result.message?.content,
    );
    return {
      data,
      usage: {
        inputTokens: result.usage?.prompt_tokens || result.prompt_eval_count || 0,
        outputTokens: result.usage?.completion_tokens || result.eval_count || 0,
        milliseconds: Date.now() - start,
        provider: config.provider,
        model: config.model,
        promptVersion: PROMPT_VERSION,
        settings: effectiveModelSettings(config),
        outputLimit,
      },
    };
  }
}

export function effectiveModelSettings(config) {
  const { temperature, maxOutputTokens, reasoningEffort, contextWindow } = validateModelSettings(
    config.settings,
  );
  return {
    temperature,
    maxOutputTokens,
    ...(config.provider === 'ollama'
      ? { contextWindow, thinking: false }
      : String(config.model).includes('gpt-oss')
        ? { reasoningEffort }
        : {}),
  };
}

export async function checkModel(config, options = {}) {
  const result = await callModel(
    config,
    'Vérification de connexion : réponds exactement avec un objet JSON contenant la propriété ok à true.',
    'Retourne {"ok":true}.',
    {
      ...options,
      maxTokens: 512,
      retries: 0,
      signal: options.signal || AbortSignal.timeout(60000),
    },
  );
  if (result.data.ok !== true)
    throw new ModelError(
      'Le modèle répond, mais il n’a pas respecté le format JSON attendu.',
      502,
      'INCOMPATIBLE_MODEL',
    );
  return {
    ok: true,
    provider: config.provider,
    model: config.model,
    settings: effectiveModelSettings(config),
    usage: result.usage,
    checkedAt: new Date().toISOString(),
    message:
      'Connexion et réponse JSON vérifiées. Ce test court ne mesure pas la qualité de l’analyse.',
  };
}

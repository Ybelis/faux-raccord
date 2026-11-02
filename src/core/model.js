import { PROMPT_VERSION } from './prompts.js';
export class ModelError extends Error {
  constructor(message, status = 502, code = 'MODEL_ERROR') { super(message); this.status = status; this.code = code; }
}
export function modelConfig(env = {}, provider = 'groq', model) {
  if (!['groq', 'ollama'].includes(provider)) throw new ModelError('Fournisseur inconnu.', 400);
  if (provider === 'groq' && !env.GROQ_API_KEY) throw new ModelError('Configurez GROQ_API_KEY dans le fichier .env du serveur.', 503, 'MISSING_KEY');
  if (provider === 'ollama' && !env.LOCAL_MODE) throw new ModelError('Ollama est disponible avec le lancement local du projet.', 400);
  const name = model || (provider === 'groq' ? env.GROQ_MODEL || 'openai/gpt-oss-20b' : env.OLLAMA_MODEL || 'qwen3:1.7b');
  if (!/^[a-zA-Z0-9._:/-]{1,100}$/.test(name) || name.includes('..')) throw new ModelError('Nom du modèle invalide.', 400);
  return { provider, model: name, baseUrl: provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : `${env.OLLAMA_URL || 'http://127.0.0.1:11434'}/api/chat`, key: env.GROQ_API_KEY };
}

export function parseModelJSON(content) {
  const text = String(content || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
  try { const value = JSON.parse(text); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw new ModelError('Le modèle a renvoyé un JSON invalide. Relancez l’analyse.', 502, 'INVALID_JSON'); }
}

export async function callModel(config, system, user, { maxTokens = 5000, signal, fetcher = fetch, retries = 2 } = {}) {
  const start = Date.now();
  const messages = [{ role: 'system', content: 'Réponds exclusivement en JSON valide.\n' + system }, { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) }];
  for (let attempt = 0; ; attempt++) {
    const body = config.provider === 'groq' ? { model: config.model, messages, temperature: 0, max_completion_tokens: maxTokens, response_format: { type: 'json_object' }, reasoning_effort: 'low' } : { model: config.model, messages, format: 'json', stream: false, think: false, options: { temperature: 0, num_predict: maxTokens, num_ctx: 16384 } };
    // reasoning_effort is model-specific, not valid for all Groq models.
    if (config.provider === 'groq' && !config.model.includes('gpt-oss')) delete body.reasoning_effort;
    let response;
    try { response = await fetcher(config.baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.provider === 'groq' ? { Authorization: `Bearer ${config.key}` } : {}) }, body: JSON.stringify(body), signal: signal || AbortSignal.timeout(180000) }); }
    catch (error) { throw new ModelError(error.name === 'AbortError' ? 'Analyse interrompue.' : 'Le moteur IA ne répond pas. Vérifiez sa connexion.', 502, 'MODEL_UNREACHABLE'); }
    if ([429, 500, 502, 503].includes(response.status) && attempt < retries) {
      const wait = Math.min(30000, Math.max(2000 * (attempt + 1), Number(response.headers.get('retry-after') || 0) * 1000));
      await new Promise(r => setTimeout(r, wait)); continue;
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 400 && result.error?.code === 'json_validate_failed' && attempt < retries) { messages.push({ role: 'user', content: 'Réponds avec un objet JSON valide uniquement. Toutes les chaînes doivent être correctement échappées. Respecte exactement les clés et identifiants demandés.' }); continue; }
    if (!response.ok) {
      const error = new ModelError(response.status === 401 ? 'La clé Groq est refusée.' : response.status === 429 ? 'Limite Groq atteinte. Réessayez dans une minute ou utilisez Ollama.' : `Le fournisseur a refusé la requête (${response.status}, ${String(result.error?.code || result.error?.type || 'inconnu').slice(0, 80)}).`, response.status === 401 ? 401 : 502, response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR');
      error.details = String(result.error?.message || '').replace(/gsk_[A-Za-z0-9]+/g, '[REDACTED]').slice(0, 450);
      throw error;
    }
    const data = parseModelJSON(config.provider === 'groq' ? result.choices?.[0]?.message?.content : result.message?.content);
    return { data, usage: { inputTokens: result.usage?.prompt_tokens || result.prompt_eval_count || 0, outputTokens: result.usage?.completion_tokens || result.eval_count || 0, milliseconds: Date.now() - start, provider: config.provider, model: config.model, promptVersion: PROMPT_VERSION } };
  }
}

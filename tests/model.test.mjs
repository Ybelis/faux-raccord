import test from 'node:test';
import assert from 'node:assert/strict';
import {
  callModel,
  checkModel,
  listModels,
  modelConfig,
  validateModelSettings,
  DEFAULT_MODEL_SETTINGS,
} from '../src/core/model.js';
import { api } from '../worker/api.js';

const environment = { GROQ_API_KEY: 'test-secret', LOCAL_MODE: true };
const groqReply = (content = '{"ok":true}') =>
  Response.json({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 12, completion_tokens: 4 },
  });

test('model parameters retain benchmark defaults and reject invalid resource budgets', () => {
  assert.deepEqual(validateModelSettings(), DEFAULT_MODEL_SETTINGS);
  for (const invalid of [
    null,
    [],
    { temperature: 1.5 },
    { temperature: '0' },
    { maxOutputTokens: -1 },
    { maxOutputTokens: 5000.5 },
    { contextWindow: 4095 },
    { reasoningEffort: 'unlimited' },
  ]) {
    assert.throws(() => validateModelSettings(invalid));
  }
  assert.equal(
    validateModelSettings({ maxOutputTokens: 8000, ignored: 'value' }).maxOutputTokens,
    8000,
  );
  assert.ok(!Object.hasOwn(validateModelSettings({ apiKey: 'must-not-be-kept' }), 'apiKey'));
});

test('Groq requests apply the selected settings and record the effective configuration', async () => {
  const config = modelConfig(environment, 'groq', 'openai/gpt-oss-20b', {
    temperature: 0.3,
    maxOutputTokens: 8000,
    reasoningEffort: 'high',
  });
  let sent;
  const result = await callModel(config, 'JSON uniquement', 'Test', {
    fetcher: async (url, request) => {
      sent = JSON.parse(request.body);
      return groqReply();
    },
  });
  assert.equal(sent.temperature, 0.3);
  assert.equal(sent.max_completion_tokens, 8000);
  assert.equal(sent.reasoning_effort, 'high');
  assert.equal(sent.response_format.type, 'json_object');
  assert.deepEqual(result.usage.settings, {
    temperature: 0.3,
    maxOutputTokens: 8000,
    reasoningEffort: 'high',
  });
  assert.ok(!JSON.stringify(result).includes(environment.GROQ_API_KEY));
});

test('stage ceilings are preserved and model-specific reasoning is omitted for other models', async () => {
  const config = modelConfig(environment, 'groq', 'llama-3.3-70b-versatile', {
    maxOutputTokens: 8000,
  });
  let sent;
  await callModel(config, 'JSON', 'Test', {
    maxTokens: 1200,
    fetcher: async (url, request) => {
      sent = JSON.parse(request.body);
      return groqReply();
    },
  });
  assert.equal(sent.max_completion_tokens, 1200);
  assert.ok(!Object.hasOwn(sent, 'reasoning_effort'));
});

test('Ollama receives its context and output settings without a Groq credential', async () => {
  const config = modelConfig(environment, 'ollama', 'qwen3:1.7b', {
    temperature: 0.1,
    maxOutputTokens: 2500,
    contextWindow: 32768,
  });
  let request;
  const result = await callModel(config, 'JSON', 'Test', {
    fetcher: async (url, options) => {
      request = options;
      return Response.json({
        message: { content: '{"ok":true}' },
        prompt_eval_count: 8,
        eval_count: 3,
      });
    },
  });
  const sent = JSON.parse(request.body);
  assert.deepEqual(sent.options, { temperature: 0.1, num_predict: 2500, num_ctx: 32768 });
  assert.equal(sent.think, false);
  assert.ok(!Object.hasOwn(request.headers, 'Authorization'));
  assert.equal(config.key, undefined);
  assert.equal(result.usage.settings.contextWindow, 32768);
});

test('Groq catalogue filters non-chat models and exposes only selected metadata', async () => {
  let requestedUrl;
  const result = await listModels(environment, 'groq', {
    fetcher: async (url, request) => {
      requestedUrl = url;
      assert.equal(request.headers.Authorization, 'Bearer test-secret');
      return Response.json({
        data: [
          {
            id: 'openai/gpt-oss-20b',
            active: true,
            context_window: 131072,
            owned_by: 'OpenAI',
            internalSecret: 'hidden',
          },
          { id: 'whisper-large-v3' },
          { id: 'meta-llama/llama-guard-4-12b' },
          { id: '../../.env' },
          { id: 'retired-model', active: false },
        ],
      });
    },
  });
  assert.equal(requestedUrl, 'https://api.groq.com/openai/v1/models');
  assert.equal(result.models.length, 1);
  assert.equal(result.models[0].contextWindow, 131072);
  assert.ok(!JSON.stringify(result).includes('hidden'));
  assert.ok(!JSON.stringify(result).includes('test-secret'));
});

test('local catalogue uses installed Ollama tags and remains unavailable on hosted execution', async () => {
  let requestedUrl;
  const result = await listModels(environment, 'ollama', {
    fetcher: async (url) => {
      requestedUrl = url;
      return Response.json({
        models: [
          {
            name: 'qwen3:1.7b',
            size: 1200000000,
            details: { parameter_size: '1.7B', quantization_level: 'Q4_K_M' },
          },
        ],
      });
    },
  });
  assert.equal(requestedUrl, 'http://127.0.0.1:11434/api/tags');
  assert.equal(result.models[0].quantization, 'Q4_K_M');
  await assert.rejects(() => listModels({ GROQ_API_KEY: 'test' }, 'ollama'), /local/);
});

test('a model check sends no screenplay and rejects a valid JSON reply with the wrong contract', async () => {
  const config = modelConfig(environment);
  let sent;
  const result = await checkModel(config, {
    fetcher: async (url, request) => {
      sent = JSON.parse(request.body);
      return groqReply();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(sent.max_completion_tokens, 512);
  assert.ok(sent.messages[1].content.includes('{"ok":true}'));
  await assert.rejects(
    () => checkModel(config, { fetcher: async () => groqReply('{"ok":false}') }),
    /format JSON/,
  );
});

test('provider catalogue errors do not expose authentication data', async () => {
  await assert.rejects(
    () =>
      listModels(environment, 'groq', {
        fetcher: async () => Response.json({ error: { message: 'test-secret' } }, { status: 401 }),
      }),
    (error) => error.status === 401 && !error.message.includes('test-secret'),
  );
});

test('catalogue and explicit connection routes work without a screenplay and keep secrets server-side', async (context) => {
  const captured = [];
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    captured.push({ url, options });
    if (url.endsWith('/models'))
      return Response.json({ data: [{ id: 'openai/gpt-oss-20b', context_window: 131072 }] });
    return groqReply();
  });
  const catalog = await api(new Request('http://localhost/api/models?provider=groq'), environment);
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).models[0].id, 'openai/gpt-oss-20b');
  const check = await api(
    new Request('http://localhost/api/models/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        settings: { temperature: 0.1 },
        apiKey: 'client-key',
        baseUrl: 'http://untrusted.invalid/',
      }),
    }),
    environment,
  );
  const body = await check.text();
  assert.equal(check.status, 200, body);
  assert.equal(JSON.parse(body).ok, true);
  assert.equal(captured[1].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured[1].options.headers.Authorization, 'Bearer test-secret');
  assert.ok(!body.includes('test-secret'));
  assert.ok(!body.includes('client-key'));
});

test('invalid settings and cross-origin model checks are rejected before any inference', async (context) => {
  const provider = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected provider call');
  });
  const request = (body, origin) =>
    new Request('http://localhost/api/models/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await api(request({ settings: { maxOutputTokens: 999999 } }), environment)).status,
    400,
  );
  assert.equal((await api(request({ provider: 'ollama' }), { GROQ_API_KEY: 'test' })).status, 400);
  assert.equal((await api(request({}, 'http://untrusted.invalid'), environment)).status, 403);
  assert.equal(provider.mock.callCount(), 0);
});

test('cancellation interrupts a quota retry instead of waiting for its full delay', async () => {
  const controller = new AbortController();
  const pending = callModel(modelConfig(environment), 'JSON', 'Test', {
    signal: controller.signal,
    fetcher: async () => Response.json({}, { status: 429, headers: { 'retry-after': '30' } }),
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(() => pending, /interrompue/);
});

function analysisRequest(signal) {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent: true,
      scenes: [
        {
          id: 'S001',
          heading: 'INT. ATELIER - JOUR',
          pages: [1],
          text: 'Alice pose une montre argentée sur la table.',
        },
      ],
    }),
    signal,
  });
}

// Le faux fournisseur reste en attente jusqu'au véritable signal d'annulation.
// On vérifie ainsi l'arrêt de l'appel, pas seulement celui de l'affichage.
function pendingProvider(context) {
  const started = Promise.withResolvers();
  const aborted = Promise.withResolvers();
  context.mock.method(
    globalThis,
    'fetch',
    async (url, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            aborted.resolve(options.signal);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
        started.resolve(options.signal);
      }),
  );
  return { started: started.promise, aborted: aborted.promise };
}

test(
  'cancelling the NDJSON response also aborts the pending provider request',
  { timeout: 2000 },
  async (context) => {
    const provider = pendingProvider(context);
    const response = await api(analysisRequest(), environment);
    const providerSignal = await provider.started;
    assert.equal(providerSignal.aborted, false);
    await response.body.cancel();
    await provider.aborted;
    assert.equal(providerSignal.aborted, true);
  },
);

test(
  'a disconnected request aborts inference and safely closes the progress stream',
  { timeout: 2000 },
  async (context) => {
    const provider = pendingProvider(context);
    const disconnect = new AbortController();
    const response = await api(analysisRequest(disconnect.signal), environment);
    const reader = response.body.getReader();
    const providerSignal = await provider.started;
    const first = await reader.read();
    assert.equal(JSON.parse(new TextDecoder().decode(first.value)).type, 'progress');
    disconnect.abort();
    await provider.aborted;
    assert.equal(providerSignal.aborted, true);
    const last = await reader.read();
    assert.equal(JSON.parse(new TextDecoder().decode(last.value)).type, 'error');
    assert.equal((await reader.read()).done, true);
  },
);

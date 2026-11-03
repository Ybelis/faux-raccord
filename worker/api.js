import { parseScreenplay } from '../src/core/parser.js';
import { retrieve } from '../src/core/retrieval.js';
import { analyze, answerQuestion } from '../src/core/pipeline.js';
import { editScene, EDIT_PROMPT_VERSION } from '../src/core/scene-edit.js';
import {
  callModel,
  modelConfig,
  listModels,
  checkModel,
  DEFAULT_MODEL_SETTINGS,
  ModelError,
} from '../src/core/model.js';
import { withContinuityProfile } from '../src/core/inference-profile.js';
import { responseLanguage, withResponseLanguage, languageMetadata } from './response-language.js';
import { handleSources } from './sources.js';
import { importDocument, ImportError } from './imports.js';
import { RequestError, checkRequestOrigin, readJsonRequest } from './request-safety.js';
import { enforceAnswerEvidence } from './llm-safety.js';
import { demo } from '../data/demo.js';
import valkaama from '../data/valkaama.json' with { type: 'json' };
import controlled from '../data/controlled-script/project.json' with { type: 'json' };

let recorded = {},
  evaluation = { status: 'not_run', message: 'Évaluation non exécutée.' };
export function setRecorded(data) {
  recorded = data || {};
}
export function setEvaluation(data) {
  evaluation = data;
}
const encoder = new TextEncoder();
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const samples = { [controlled.id]: controlled, valkaama, [demo.id]: demo };
const sampleScenes = (sample) =>
  sample.scenes
    ? { scenes: sample.scenes, warnings: sample.warnings || [] }
    : parseScreenplay(sample.pages ? sample : sample.text);

function validateScenes(scenes) {
  if (!Array.isArray(scenes) || !scenes.length || scenes.length > 60)
    throw new RequestError('Choisissez entre 1 et 60 scènes.');
  const ids = new Set();
  if (
    scenes.some((s) => {
      if (
        !s ||
        typeof s !== 'object' ||
        Array.isArray(s) ||
        typeof s.text !== 'string' ||
        !s.text.trim() ||
        s.text.length > 14000 ||
        typeof s.id !== 'string' ||
        !/^S\d{3}$/.test(s.id) ||
        ids.has(s.id) ||
        (s.heading != null && (typeof s.heading !== 'string' || s.heading.length > 500)) ||
        !Array.isArray(s.pages) ||
        !s.pages.length ||
        s.pages.length > 200 ||
        !s.pages.every((page) => Number.isSafeInteger(page) && page > 0 && page <= 100_000)
      )
        return true;
      if (
        s.pageSegments != null &&
        (!Array.isArray(s.pageSegments) ||
          s.pageSegments.length > 200 ||
          s.pageSegments.some(
            (segment) =>
              !segment ||
              typeof segment.text !== 'string' ||
              segment.text.length > 20000 ||
              !s.pages.includes(segment.page),
          ) ||
          s.pageSegments.reduce((total, segment) => total + segment.text.length, 0) > 20000)
      )
        return true;
      ids.add(s.id);
      return false;
    })
  )
    throw new RequestError('Format des scènes invalide.');
  if (scenes.reduce((n, s) => n + s.text.length, 0) > 120000)
    throw new RequestError('Sélection trop longue. Analysez le scénario par lots.');
}

export async function api(request, env = {}) {
  const url = new URL(request.url),
    path = url.pathname;
  try {
    checkRequestOrigin(request);
    const sourceResponse = await handleSources(request, env);
    if (sourceResponse) return sourceResponse;
    if (path === '/api/status')
      return json({
        version: '1.1.0',
        groq: Boolean(env.GROQ_API_KEY),
        ollama: Boolean(env.LOCAL_MODE),
        model: env.GROQ_MODEL || 'openai/gpt-oss-20b',
        ollamaModel: env.OLLAMA_MODEL || 'qwen3:1.7b',
        modelSettings: DEFAULT_MODEL_SETTINGS,
        storage: 'device',
      });
    if (path === '/api/models' && request.method === 'GET')
      return json(await listModels(env, url.searchParams.get('provider') || 'groq'));
    if (path === '/api/samples')
      return json(
        Object.values(samples).map((s) => ({
          id: s.id,
          title: s.title,
          author: s.author,
          license: s.license,
          synthetic: s.synthetic,
          controlled: s.controlled,
          controlledInjectionCount: s.controlledInjectionCount,
          description: s.description,
          sceneCount: sampleScenes(s).scenes.length,
        })),
      );
    if (path.startsWith('/api/samples/')) {
      const key = path.split('/').at(-1);
      const s = Object.hasOwn(samples, key) ? samples[key] : null;
      if (!s) return json({ error: 'Scénario introuvable.' }, 404);
      return json({
        ...s,
        ...sampleScenes(s),
        analysis: recorded[s.id] ? { ...recorded[s.id], recorded: true } : null,
      });
    }
    if (path === '/api/evaluation') return json(evaluation);
    if (request.method !== 'POST') return json({ error: 'Route introuvable.' }, 404);
    if (path === '/api/import') {
      return json(await importDocument(request));
    }
    if (
      !['/api/models/check', '/api/search', '/api/ask', '/api/analyze', '/api/edit'].includes(path)
    )
      return json({ error: 'Route introuvable.' }, 404);
    const body = await readJsonRequest(request);
    // Model checks contain no screenplay: they validate a short JSON reply only.
    if (path === '/api/models/check')
      return json(
        await checkModel(modelConfig(env, body.provider || 'groq', body.model, body.settings), {
          signal: request.signal.aborted
            ? request.signal
            : AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
        }),
      );
    validateScenes(body.scenes);
    if (path === '/api/search') {
      if (typeof body.query !== 'string' || body.query.length > 500)
        throw new RequestError('La recherche doit contenir au maximum 500 caractères.');
      return json({
        sources: retrieve(body.scenes, body.query, { topK: 8 }),
      });
    }
    const config = modelConfig(env, body.provider || 'groq', body.model, body.settings);
    if (body.language !== undefined && !['fr', 'en'].includes(body.language))
      throw new RequestError('Langue invalide : choisissez fr ou en.');
    const language = responseLanguage(body.language);
    const generate = withResponseLanguage(callModel, language);
    if (path === '/api/edit') {
      if (body.consent !== true)
        throw new RequestError(
          'Confirmez que ces scènes peuvent être analysées par le moteur choisi.',
        );
      if (typeof body.instruction !== 'string')
        throw new RequestError('La consigne doit contenir entre 3 et 800 caractères.');
      const instruction = body.instruction.trim();
      if (body.scenes.length !== 1)
        return json({ error: 'Une seule scène peut être modifiée à la fois.' }, 400);
      if (instruction.length < 3 || instruction.length > 800)
        return json({ error: 'La consigne doit contenir entre 3 et 800 caractères.' }, 400);
      if (typeof body.scenes[0].heading !== 'string' || !body.scenes[0].heading.trim())
        throw new RequestError('Format des scènes invalide.');
      return json({
        ...(await editScene(body.scenes[0], instruction, config, {
          model: generate,
          signal: request.signal,
        })),
        editPromptVersion: EDIT_PROMPT_VERSION,
        ...languageMetadata(language),
      });
    }
    if (path === '/api/ask') {
      if (typeof body.question !== 'string')
        throw new RequestError('La question doit contenir entre 3 et 800 caractères.');
      const question = body.question.trim();
      if (question.length < 3 || question.length > 800)
        return json({ error: 'La question doit contenir entre 3 et 800 caractères.' }, 400);
      return json({
        ...enforceAnswerEvidence(
          await answerQuestion(body.scenes, question, config, { model: generate }),
        ),
        ...languageMetadata(language),
      });
    }
    if (path === '/api/analyze') {
      if (body.consent !== true)
        return json(
          { error: 'Confirmez que ces scènes peuvent être analysées par le moteur choisi.' },
          400,
        );
      let cancelled = false;
      // Fermer la réponse ne ferme pas forcément la requête HTTP déjà lue.
      // L'annulation du lecteur NDJSON doit donc aussi interrompre le modèle.
      const analysisController = new AbortController();
      const analysisSignal = AbortSignal.any([request.signal, analysisController.signal]);
      const stream = new ReadableStream({
        start(controller) {
          const emit = (value) => {
            if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
          };
          const profiled =
            config.provider === 'groq'
              ? withContinuityProfile(generate, {
                  onProgress: (progress) => emit({ type: 'progress', ...progress }),
                })
              : null;
          analyze(body.scenes, config, {
            model: profiled || generate,
            signal: analysisSignal,
            onProgress: (progress) => emit({ type: 'progress', ...progress }),
          })
            .then((result) => {
              Object.assign(result, languageMetadata(language));
              if (profiled) {
                result.inferenceProfile = profiled.profile;
                result.usage.logicalCalls = profiled.stats.logicalCalls;
                result.usage.physicalCalls = profiled.stats.physicalCalls;
                result.usage.calls = profiled.stats.physicalCalls;
              }
              // Aucun objet n'est différent d'une extraction dont toutes les
              // citations ont été rejetées. Rendre cet échec visible à la revue.
              if (!result.objects.length && result.rejectedEvidence > 0) {
                result.warnings = [
                  'Les citations produites par le modèle ont été rejetées. Aucun accessoire exploitable n’a été extrait ; ce résultat ne permet pas de conclure à l’absence d’incohérence. Essayez un autre modèle.',
                ];
              }
              emit({ type: 'result', result });
              if (!cancelled) controller.close();
            })
            .catch((error) => {
              emit({ type: 'error', error: error.message, code: error.code });
              if (!cancelled) controller.close();
            });
        },
        cancel() {
          cancelled = true;
          analysisController.abort();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    return json({ error: 'Route introuvable.' }, 404);
  } catch (error) {
    const expected =
      error instanceof RequestError || error instanceof ImportError || error instanceof ModelError;
    return json(
      {
        error: expected ? error.message : 'Le serveur ne peut pas traiter cette requête.',
        code: expected ? error.code || 'INVALID_REQUEST' : 'INTERNAL_ERROR',
      },
      expected ? error.status : 500,
    );
  }
}

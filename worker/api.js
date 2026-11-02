import { parseScreenplay } from '../src/core/parser.js';
import { retrieve } from '../src/core/retrieval.js';
import { analyze, answerQuestion } from '../src/core/pipeline.js';
import { modelConfig, listModels, checkModel, DEFAULT_MODEL_SETTINGS } from '../src/core/model.js';
import { handleSources } from './sources.js';
import { demo } from '../data/demo.js';
import valkaama from '../data/valkaama.json' with { type: 'json' };

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
const samples = { valkaama, [demo.id]: demo };

function validateScenes(scenes) {
  if (!Array.isArray(scenes) || !scenes.length || scenes.length > 60)
    throw new Error('Choisissez entre 1 et 60 scènes.');
  if (
    scenes.some(
      (s) => typeof s.text !== 'string' || s.text.length > 14000 || !/^S\d{3}$/.test(s.id),
    )
  )
    throw new Error('Format des scènes invalide.');
  if (scenes.reduce((n, s) => n + s.text.length, 0) > 120000)
    throw new Error('Sélection trop longue. Analysez le scénario par lots.');
}

export async function api(request, env = {}) {
  const url = new URL(request.url),
    path = url.pathname;
  try {
    const origin = request.headers.get('origin');
    if (request.method === 'POST' && origin && origin !== url.origin)
      return json({ error: 'Origine de requête non autorisée.' }, 403);
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
          description: s.description,
          sceneCount: parseScreenplay(s.pages ? s : s.text).scenes.length,
        })),
      );
    if (path.startsWith('/api/samples/')) {
      const s = samples[path.split('/').at(-1)];
      if (!s) return json({ error: 'Scénario introuvable.' }, 404);
      return json({
        ...s,
        ...parseScreenplay(s.pages ? s : s.text),
        analysis: recorded[s.id] || null,
      });
    }
    if (path === '/api/evaluation') return json(evaluation);
    if (request.method !== 'POST') return json({ error: 'Route introuvable.' }, 404);
    const size = Number(request.headers.get('content-length') || 0);
    if (size > 6 * 1024 * 1024)
      return json({ error: 'Le fichier dépasse la limite de 5 Mo.' }, 413);
    if (path === '/api/import') {
      const form = await request.formData(),
        file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function' || file.size > 5 * 1024 * 1024)
        return json({ error: 'Importez un fichier PDF, TXT ou Fountain de moins de 5 Mo.' }, 400);
      const ext = file.name.toLowerCase().split('.').at(-1);
      let input;
      if (ext === 'pdf') {
        const { getDocumentProxy } = await import('unpdf');
        const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()), {
          maxImageSize: 1000000,
          isEvalSupported: false,
        });
        if (pdf.numPages > 160) {
          if (typeof pdf.destroy === 'function') await pdf.destroy();
          return json({ error: 'PDF trop long : 160 pages maximum.' }, 400);
        }
        const pages = [];
        try {
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i),
              content = await page.getTextContent();
            let text = '',
              lastY = null;
            for (const item of content.items) {
              if (!('str' in item)) continue;
              const y = Math.round(item.transform?.[5] || 0);
              if (lastY !== null && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
              text += item.str + (item.hasEOL ? '\n' : ' ');
              lastY = y;
            }
            pages.push({ page: i, text });
          }
        } finally {
          if (typeof pdf.destroy === 'function') await pdf.destroy();
          else if (typeof pdf.cleanup === 'function') await pdf.cleanup();
        }
        input = { pages };
      } else if (['txt', 'fountain', 'md'].includes(ext)) input = await file.text();
      else
        return json(
          { error: 'Formats acceptés : PDF avec texte, TXT, Fountain et Markdown.' },
          400,
        );
      return json({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
        author: 'Document importé',
        filename: file.name,
        license: 'À documenter',
        synthetic: false,
        ...parseScreenplay(input),
        analysis: null,
      });
    }
    const raw = await request.text();
    if (raw.length > 1400000) return json({ error: 'Requête trop volumineuse.' }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Requête JSON invalide.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ error: 'La requête doit contenir un objet JSON.' }, 400);
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
    if (path === '/api/search')
      return json({
        sources: retrieve(body.scenes, String(body.query || '').slice(0, 500), { topK: 8 }),
      });
    const config = modelConfig(env, body.provider || 'groq', body.model, body.settings);
    if (path === '/api/ask') {
      const question = String(body.question || '').trim();
      if (question.length < 3 || question.length > 800)
        return json({ error: 'La question doit contenir entre 3 et 800 caractères.' }, 400);
      return json(await answerQuestion(body.scenes, question, config));
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
          analyze(body.scenes, config, {
            signal: analysisSignal,
            onProgress: (progress) => emit({ type: 'progress', ...progress }),
          })
            .then((result) => {
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
    return json(
      { error: error.message || 'Une erreur est survenue.', code: error.code || 'INVALID_REQUEST' },
      error.status || 400,
    );
  }
}

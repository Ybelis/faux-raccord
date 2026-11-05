import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScreenplay } from '../src/core/parser.js';
import { analyze } from '../src/core/pipeline.js';
import { editScene } from '../src/core/scene-edit.js';
import { callModel, modelConfig, ModelError } from '../src/core/model.js';
import { withContinuityProfile } from '../src/core/inference-profile.js';
import { languageMetadata, withResponseLanguage } from '../worker/response-language.js';

// Le contrôleur choisit ces deux sources connues. Les paramètres du modèle
// ne peuvent désigner ni un fichier arbitraire, ni une URL, ni un fournisseur.
const CORPORA = new Map([
  ['controlled-valkaama', new URL('../data/controlled-script/project.json', import.meta.url)],
  ['valkaama', new URL('../data/valkaama.json', import.meta.url)],
]);
const TOOLS = new Set(['check_continuity', 'create_revision_draft']);
const SCENE_ID = /^S[0-9]{3}$/;
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_ALERTS = 12;

export class ActionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const invalid = (message) => {
  throw new ActionError('INVALID_ARGUMENTS', message);
};

function retryDelay(details) {
  const duration = String(details || '')
    .toLowerCase()
    .match(/(?:try again in|retry after)\s+((?:\d+(?:\.\d+)?(?:ms|h|m|s)\s*)+)/)?.[1];
  const units = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  const milliseconds = duration
    ? [...duration.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)].reduce(
        (sum, part) => sum + Number(part[1]) * units[part[2]],
        0,
      )
    : 60_000;
  return Math.min(60_000, Math.max(1000, milliseconds + 250));
}

function validateArguments(tool, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args))
    invalid('Arguments must be a JSON object.');
  const allowed = tool === 'check_continuity' ? ['scene_ids'] : ['scene_id', 'instruction'];
  if (Object.keys(args).some((key) => !allowed.includes(key)))
    invalid(`Allowed arguments are ${allowed.join(', ')}.`);
  if (tool === 'check_continuity') {
    const ids = args.scene_ids;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 12 ||
      ids.some((id) => typeof id !== 'string' || !SCENE_ID.test(id)) ||
      new Set(ids).size !== ids.length
    )
      invalid('scene_ids must contain 1 to 12 unique identifiers such as S001.');
    return { sceneIds: ids };
  }
  if (typeof args.scene_id !== 'string' || !SCENE_ID.test(args.scene_id))
    invalid('scene_id must identify one scene, such as S002.');
  if (typeof args.instruction !== 'string' || args.instruction.includes('\0'))
    invalid('instruction must be text without NUL characters.');
  const instruction = args.instruction.trim();
  if (instruction.length < 3 || instruction.length > 800)
    invalid('instruction must contain between 3 and 800 characters after trimming.');
  return { sceneIds: [args.scene_id], instruction };
}

async function loadCorpus(sample, expectedRevision) {
  if (!CORPORA.has(sample) || !/^[a-f0-9]{64}$/.test(expectedRevision || ''))
    throw new ActionError('INVALID_CONTEXT', 'Choose an allowed corpus and its source revision.');
  const bytes = await readFile(CORPORA.get(sample));
  if (bytes.length > 2 * 1024 * 1024)
    throw new ActionError('INVALID_CORPUS', 'The bundled corpus exceeds its size limit.');
  const revision = createHash('sha256').update(bytes).digest('hex');
  if (revision !== expectedRevision)
    throw new ActionError('STALE_REVISION', 'The screenplay changed; reconnect before continuing.');
  const project = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const parsed = project.scenes
    ? { scenes: project.scenes, warnings: project.warnings || [] }
    : parseScreenplay(project.pages ? project : project.text);
  if (
    !parsed.scenes.length ||
    parsed.scenes.length > 200 ||
    parsed.scenes.some((scene) => scene.text.length > 14_000)
  )
    throw new ActionError('INVALID_CORPUS', 'The selected screenplay exceeds its scene limits.');
  return {
    scenes: parsed.scenes,
    warnings: parsed.warnings,
    script: {
      id: project.id,
      title: project.title,
      revision,
      license: project.license,
      scene_count: parsed.scenes.length,
    },
  };
}

/** Execute existing generation code; draft persistence belongs to the host. */
export async function executeAction({
  tool,
  args,
  sample = 'controlled-valkaama',
  revision,
  model = callModel,
  env = process.env,
  signal,
  maxModelCalls = 12,
  minRetryWaitMs = 60_000,
  sleep = (milliseconds, signal) => delay(milliseconds, undefined, { signal }),
}) {
  if (!TOOLS.has(tool)) throw new ActionError('UNKNOWN_TOOL', 'Choose an implemented action tool.');
  if (!Number.isInteger(maxModelCalls) || maxModelCalls < 1 || maxModelCalls > 16)
    throw new ActionError(
      'INVALID_CONTEXT',
      'The host model-call allowance must be between 1 and 16.',
    );
  if (!Number.isInteger(minRetryWaitMs) || minRetryWaitMs < 0 || minRetryWaitMs > 60_000)
    throw new ActionError(
      'INVALID_CONTEXT',
      'The retry wait floor must be between 0 and 60000 ms.',
    );
  const input = validateArguments(tool, args);
  const corpus = await loadCorpus(sample, revision);
  const existing = new Set(corpus.scenes.map((scene) => scene.id));
  const missing = input.sceneIds.filter((id) => !existing.has(id));
  if (missing.length)
    throw new ActionError(
      'UNKNOWN_SCENE',
      `Unknown scene identifiers: ${missing.slice(0, 5).join(', ')}. Choose scenes from the selected screenplay.`,
    );
  // Le tri suit toujours le scénario, même si les IDs arrivent dans le désordre.
  const scenes = corpus.scenes.filter((scene) => input.sceneIds.includes(scene.id));
  if (scenes.reduce((total, scene) => total + scene.text.length, 0) > 120_000)
    invalid('The selected scenes exceed the 120,000-character analysis limit.');
  const config = modelConfig(env, 'groq', env.AGENT_TOOL_MODEL || 'openai/gpt-oss-120b', {
    temperature: 0,
    reasoningEffort: 'low',
    maxOutputTokens: 3000,
  });
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, milliseconds: 0, unmeasuredCalls: 0 };
  const retryWarnings = [];
  const countedModel = async (configuration, prompt, input, options = {}) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (usage.calls >= maxModelCalls)
        throw new ActionError(
          'MODEL_CALL_LIMIT',
          'The action reached its host model-call allowance.',
        );
      // Compter avant l'envoi inclut les tentatives qui échouent. Aucun retry
      // caché dans callModel() ne peut contourner cette limite physique.
      usage.calls++;
      const start = Date.now();
      try {
        const response = await model(configuration, prompt, input, { ...options, retries: 0 });
        usage.inputTokens += response.usage?.inputTokens || 0;
        usage.outputTokens += response.usage?.outputTokens || 0;
        usage.milliseconds += response.usage?.milliseconds ?? Date.now() - start;
        return response;
      } catch (error) {
        usage.unmeasuredCalls++;
        usage.milliseconds += Date.now() - start;
        if (
          !(error instanceof ModelError) ||
          error.code !== 'RATE_LIMIT' ||
          error.dailyQuota ||
          attempt > 0 ||
          usage.calls >= maxModelCalls ||
          signal?.aborted
        )
          throw error;
        // Le palier gratuit compte les tokens sur une minute glissante : un
        // court retry-after ne libère pas forcément assez de contexte.
        const wait = Math.max(minRetryWaitMs, retryDelay(error.details));
        retryWarnings.push(
          `A temporary rate limit required a ${wait} ms wait and one retry; both attempts count toward the model-call budget.`,
        );
        await sleep(wait, signal);
      }
    }
  };
  const generate = withResponseLanguage(countedModel, 'en');
  try {
    if (tool === 'create_revision_draft') {
      const proposal = await editScene(scenes[0], input.instruction, config, {
        model: generate,
        signal,
      });
      return {
        script: corpus.script,
        scene_id: scenes[0].id,
        source_scene_text: scenes[0].text,
        ...proposal,
        edit_prompt_version: proposal.editPromptVersion,
        usage: { ...proposal.usage, ...usage },
        warnings: [
          ...corpus.warnings,
          ...retryWarnings,
          'This is a proposal only; the host must save it as a separate draft.',
          'A structurally valid proposal can still change meaning; review it before approval.',
        ],
      };
    }
    const profiled = withContinuityProfile(generate);
    const result = await analyze(scenes, config, { model: profiled, signal });
    return {
      script: corpus.script,
      analyzed_scene_ids: result.analyzedSceneIds,
      alerts: result.alerts.slice(0, MAX_ALERTS),
      total_alert_count: result.alerts.length,
      candidate_count: result.candidateCount,
      rejected_evidence: result.rejectedEvidence,
      usage: {
        ...result.usage,
        ...usage,
        logicalCalls: profiled.stats.logicalCalls,
        physicalCalls: usage.calls,
      },
      model: result.model,
      provider: result.provider,
      prompt_version: result.promptVersion,
      ...languageMetadata('en'),
      warnings: [
        ...corpus.warnings,
        ...retryWarnings,
        'Alerts are review candidates, not confirmed errors; only the selected scenes were checked.',
        ...(result.alerts.length > MAX_ALERTS
          ? [
              `Only the first ${MAX_ALERTS} alerts are returned; narrow the scene selection for the others.`,
            ]
          : []),
      ],
    };
  } catch (error) {
    if (error instanceof ModelError && error.status === 401) {
      error.code = 'BAD_KEY';
      error.message = 'The configured Groq API key was rejected.';
    }
    error.usage = { ...usage };
    error.warnings = [...retryWarnings];
    throw error;
  }
}

async function readArguments() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) invalid('Arguments exceed the 16 KiB input limit.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    invalid('Arguments must be a UTF-8 JSON object.');
  }
}

async function main() {
  try {
    const options = process.argv.slice(2);
    if (
      ![6, 8].includes(options.length) ||
      options[0] !== '--sample' ||
      options[2] !== '--revision' ||
      options[4] !== '--tool' ||
      (options.length === 8 &&
        (options[6] !== '--max-model-calls' || !/^(?:[1-9]|1[0-6])$/.test(options[7])))
    )
      throw new ActionError(
        'INVALID_CONTEXT',
        'Choose an allowed corpus, revision and action tool.',
      );
    const result = await executeAction({
      sample: options[1],
      revision: options[3],
      tool: options[5],
      args: await readArguments(),
      maxModelCalls: options.length === 8 ? Number(options[7]) : 12,
    });
    const output = JSON.stringify(result);
    if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) {
      const error = new ActionError(
        'OUTPUT_LIMIT',
        'Action output exceeds 256 KiB; choose fewer scenes.',
      );
      error.usage = result.usage;
      throw error;
    }
    process.stdout.write(output);
  } catch (error) {
    const known = error instanceof ActionError || error instanceof ModelError;
    process.stdout.write(
      JSON.stringify({
        warnings: error.warnings || [],
        usage: error.usage || {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          milliseconds: 0,
          unmeasuredCalls: 0,
        },
        error: {
          code: known ? error.code : 'ACTION_FAILED',
          message: known
            ? error.message
            : 'Action failed. Check the corpus and model configuration.',
          ...(error.dailyQuota ? { daily_quota: true } : {}),
        },
      }),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();

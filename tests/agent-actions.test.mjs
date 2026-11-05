import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { executeAction } from '../agent/action_bridge.mjs';
import { parseScreenplay } from '../src/core/parser.js';
import { ModelError } from '../src/core/model.js';

const sourcePath = new URL('../data/controlled-script/project.json', import.meta.url);
const source = await readFile(sourcePath);
const revision = createHash('sha256').update(source).digest('hex');
const project = JSON.parse(source);
const scenes = parseScreenplay(project.pages ? project : project.text).scenes;
const env = { GROQ_API_KEY: 'test-key-not-used-for-a-network-request' };
const defaults = { sample: 'controlled-valkaama', revision, env };
const before = 'Runa drops her brass pocket watch. Its glass breaks and its mechanism stops.';
const after =
  'Runa checks the same brass pocket watch: its glass is intact and its mechanism works. Nobody has repaired or replaced it.';

test('agent continuity action reuses extraction and judgment with ordered, verified evidence', async () => {
  const prompts = [];
  const fakeModel = async (configuration, prompt, input) => {
    prompts.push(prompt);
    assert.equal(configuration.model, 'openai/gpt-oss-120b');
    const data = input.scenes
      ? {
          objects: [
            {
              name: 'brass pocket watch',
              aliases: ['watch'],
              mentions: [
                {
                  sceneId: 'S001',
                  quote: before,
                  state: 'broken',
                  owner: 'Runa',
                  action: 'break',
                  temporal: 'continuous',
                },
                {
                  sceneId: 'S002',
                  quote: after,
                  state: 'intact',
                  owner: 'Runa',
                  action: 'observe',
                  temporal: 'continuous',
                },
              ],
            },
          ],
        }
      : {
          results: input.candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            verdict: 'contradiction',
            title: 'The watch works again',
            explanation: 'The broken watch becomes intact without a repair.',
            question: 'Should the watch remain broken?',
          })),
        };
    return { data, usage: { inputTokens: 10, outputTokens: 5, milliseconds: 1 } };
  };
  const result = await executeAction({
    ...defaults,
    tool: 'check_continuity',
    args: { scene_ids: ['S002', 'S001'] },
    model: fakeModel,
  });
  assert.deepEqual(result.analyzed_scene_ids, ['S001', 'S002']);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(
    result.alerts[0].evidence.map((e) => e.quote),
    [before, after],
  );
  assert.equal(result.alerts[0].status, 'pending');
  assert.equal(result.usage.physicalCalls, 2);
  assert.equal(result.usage.calls, 2);
  assert.equal(result.usage.unmeasuredCalls, 0);
  assert.ok(prompts.every((p) => p.includes('english-output-v1')));
  assert.ok(!JSON.stringify(result).includes(env.GROQ_API_KEY));
  assert.deepEqual(await readFile(sourcePath), source);
});

test('the draft action produces a valid proposal and leaves the source unchanged', async () => {
  const scene = scenes.find((value) => value.id === 'S002');
  const revised = scene.text.replace(
    after,
    'Runa holds the same brass pocket watch, still broken and stopped.',
  );
  const result = await executeAction({
    ...defaults,
    tool: 'create_revision_draft',
    args: { scene_id: 'S002', instruction: 'Keep the watch broken.' },
    model: async () => ({
      data: { text: revised, summary: 'The watch remains broken.' },
      usage: { inputTokens: 10, outputTokens: 5, milliseconds: 1 },
    }),
  });
  assert.equal(result.changed, true);
  assert.equal(result.text, revised);
  assert.equal(result.source_scene_text, scene.text);
  assert.equal(result.scene_id, 'S002');
  assert.equal(result.draft_id, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes('host must save')));
  assert.deepEqual(await readFile(sourcePath), source);
});

test('invalid action arguments fail before any model call', async () => {
  let calls = 0;
  const cases = [
    ['check_continuity', { scene_ids: [] }],
    ['check_continuity', { scene_ids: ['S001', 'S001'] }],
    [
      'check_continuity',
      { scene_ids: Array.from({ length: 13 }, (_, i) => `S${String(i + 1).padStart(3, '0')}`) },
    ],
    ['check_continuity', { scene_ids: ['S001'], model: 'other-model' }],
    ['create_revision_draft', { scene_id: 'S002', instruction: ' x ' }],
    ['create_revision_draft', { scene_id: 'S002', instruction: 'x'.repeat(801) }],
    ['create_revision_draft', { scene_id: 'S002', instruction: 'watch\0' }],
    ['create_revision_draft', { scene_id: 'S002', instruction: 'Fix it.', approved: true }],
  ];
  for (const [tool, args] of cases) {
    await assert.rejects(executeAction({ ...defaults, tool, args, model: async () => calls++ }), {
      code: 'INVALID_ARGUMENTS',
    });
  }
  assert.equal(calls, 0);
});

test('unknown scenes and stale sources fail before generation', async () => {
  let calls = 0;
  const model = async () => calls++;
  await assert.rejects(
    executeAction({ ...defaults, tool: 'check_continuity', args: { scene_ids: ['S999'] }, model }),
    { code: 'UNKNOWN_SCENE' },
  );
  await assert.rejects(
    executeAction({
      ...defaults,
      revision: '0'.repeat(64),
      tool: 'check_continuity',
      args: { scene_ids: ['S001'] },
      model,
    }),
    { code: 'STALE_REVISION' },
  );
  assert.equal(calls, 0);
});

test('an invalid generated scene never becomes an applicable draft', async () => {
  const result = await executeAction({
    ...defaults,
    tool: 'create_revision_draft',
    args: { scene_id: 'S002', instruction: 'Keep the watch broken.' },
    model: async () => ({
      data: {
        text: 'INT. A DIFFERENT PLACE - DAY\nA different scene entirely.',
        summary: 'Changed everything.',
      },
      usage: { inputTokens: 10, outputTokens: 5, milliseconds: 1 },
    }),
  });
  assert.equal(result.changed, false);
  assert.equal(result.text, undefined);
  assert.equal(result.summary, 'invalid');
});

test('the host allowance caps physical model calls without hidden retries', async () => {
  let calls = 0;
  const model = async (_configuration, _prompt, input, options) => {
    calls++;
    assert.equal(options.retries, 0);
    return {
      data: {
        objects: [
          {
            name: 'brass pocket watch',
            mentions: [
              {
                sceneId: 'S001',
                quote: before,
                state: 'broken',
                owner: 'Runa',
                action: 'break',
                temporal: 'continuous',
              },
              {
                sceneId: 'S002',
                quote: after,
                state: 'intact',
                owner: 'Runa',
                action: 'observe',
                temporal: 'continuous',
              },
            ],
          },
        ],
      },
      usage: { inputTokens: 10, outputTokens: 5, milliseconds: 2 },
    };
  };
  await assert.rejects(
    executeAction({
      ...defaults,
      tool: 'check_continuity',
      args: { scene_ids: ['S001', 'S002'] },
      model,
      maxModelCalls: 1,
    }),
    (error) => {
      assert.equal(error.code, 'MODEL_CALL_LIMIT');
      assert.equal(error.usage.calls, 1);
      assert.equal(error.usage.inputTokens, 10);
      assert.equal(error.usage.outputTokens, 5);
      assert.equal(error.usage.unmeasuredCalls, 0);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('a failed physical request counts while unavailable token usage stays explicit', async () => {
  const error = new Error('Provider unavailable.');
  await assert.rejects(
    executeAction({
      ...defaults,
      tool: 'check_continuity',
      args: { scene_ids: ['S001'] },
      model: async () => {
        throw error;
      },
    }),
    (failure) => {
      assert.equal(failure, error);
      assert.equal(failure.usage.calls, 1);
      assert.equal(failure.usage.unmeasuredCalls, 1);
      return true;
    },
  );
});

test('one transient rate limit is paced and retried as a second physical request', async () => {
  const waits = [];
  let calls = 0;
  const result = await executeAction({
    ...defaults,
    minRetryWaitMs: 0,
    tool: 'check_continuity',
    args: { scene_ids: ['S001'] },
    sleep: async (milliseconds) => waits.push(milliseconds),
    model: async (_config, _prompt, _input, options) => {
      calls++;
      assert.equal(options.retries, 0);
      if (calls === 1) {
        const error = new ModelError('Temporary rate limit.', 502, 'RATE_LIMIT');
        error.details = 'Please try again in 1.5s.';
        throw error;
      }
      return {
        data: { objects: [] },
        usage: { inputTokens: 10, outputTokens: 5, milliseconds: 1 },
      };
    },
  });
  assert.deepEqual(waits, [1750]);
  assert.equal(calls, 2);
  assert.equal(result.usage.calls, 2);
  assert.equal(result.usage.unmeasuredCalls, 1);
  assert.ok(result.warnings.some((warning) => warning.includes('one retry')));
});

test('the live retry floor waits a full minute even when the provider suggests less', async () => {
  const waits = [];
  let calls = 0;
  const result = await executeAction({
    ...defaults,
    tool: 'check_continuity',
    args: { scene_ids: ['S001'] },
    sleep: async (milliseconds) => waits.push(milliseconds),
    model: async () => {
      if (++calls === 1) {
        const error = new ModelError('Temporary rate limit.', 502, 'RATE_LIMIT');
        error.details = 'Please try again in 15s.';
        throw error;
      }
      return {
        data: { objects: [] },
        usage: { inputTokens: 10, outputTokens: 5, milliseconds: 1 },
      };
    },
  });
  assert.equal(result.usage.calls, 2);
  assert.deepEqual(waits, [60_000]);
});

test('authentication failure has a safe stable code and is not retried', async () => {
  let calls = 0;
  await assert.rejects(
    executeAction({
      ...defaults,
      tool: 'check_continuity',
      args: { scene_ids: ['S001'] },
      sleep: async () => assert.fail('Authentication must not be retried.'),
      model: async () => {
        calls++;
        throw new ModelError('Unsafe upstream detail.', 401, 'PROVIDER_ERROR');
      },
    }),
    (error) =>
      error.code === 'BAD_KEY' &&
      error.message === 'The configured Groq API key was rejected.' &&
      error.usage.calls === 1,
  );
  assert.equal(calls, 1);
});

test('daily limits and invalid model content are never retried', async () => {
  for (const code of ['RATE_LIMIT', 'INVALID_JSON']) {
    let calls = 0;
    const error = new ModelError('Stop.', 502, code);
    error.dailyQuota = code === 'RATE_LIMIT';
    await assert.rejects(
      executeAction({
        ...defaults,
        tool: 'check_continuity',
        args: { scene_ids: ['S001'] },
        sleep: async () => assert.fail('No pacing is expected.'),
        model: async () => {
          calls++;
          throw error;
        },
      }),
      (failure) => failure === error && failure.usage.calls === 1,
    );
    assert.equal(calls, 1);
  }
});

test('a second transient failure stops after one retry and a fallback wait is capped', async () => {
  const waits = [];
  let calls = 0;
  const error = new ModelError('Temporary rate limit.', 502, 'RATE_LIMIT');
  await assert.rejects(
    executeAction({
      ...defaults,
      tool: 'check_continuity',
      args: { scene_ids: ['S001'] },
      sleep: async (milliseconds) => waits.push(milliseconds),
      model: async () => {
        calls++;
        throw error;
      },
    }),
    (failure) => failure === error && failure.usage.calls === 2,
  );
  assert.equal(calls, 2);
  assert.deepEqual(waits, [60_000]);
});

test('aborting a pacing wait prevents the next physical request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = executeAction({
    ...defaults,
    tool: 'check_continuity',
    args: { scene_ids: ['S001'] },
    signal: controller.signal,
    model: async () => {
      calls++;
      throw new ModelError('Temporary rate limit.', 502, 'RATE_LIMIT');
    },
    sleep: async (_milliseconds, signal) => {
      controller.abort();
      signal.throwIfAborted();
    },
  });
  await assert.rejects(pending, (error) => error.name === 'AbortError' && error.usage.calls === 1);
  assert.equal(calls, 1);
});

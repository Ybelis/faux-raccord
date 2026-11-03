import test from 'node:test';
import assert from 'node:assert/strict';
import { editScene, EDIT_PROMPT_VERSION } from '../src/core/scene-edit.js';

const scene = {
  id: 'S001',
  heading: '1. INT. ATELIER - JOUR',
  text: '1. INT. ATELIER - JOUR\nClara pose sa montre cassée sur la table.',
};
const reply =
  (text, summary = 'La montre est réparée.') =>
  async () => ({
    data: { text, summary },
    usage: { inputTokens: 1, outputTokens: 1 },
  });

test('missing headings and invalid instructions are rejected before generation', async () => {
  let calls = 0;
  const model = async () => {
    calls++;
    throw new Error('Unexpected call');
  };
  for (const input of [
    { ...scene, heading: undefined },
    { ...scene, heading: '' },
    { ...scene, heading: 'INT. AUTRE - NUIT' },
  ]) {
    assert.equal((await editScene(input, 'Répare la montre.', {}, { model })).changed, false);
  }
  for (const instruction of ['', 'ab', 'x'.repeat(801), {}, 'Répare\0 la montre'])
    assert.equal((await editScene(scene, instruction, {}, { model })).changed, false);
  assert.equal(calls, 0);
});

test('a heading buried in output or an added second scene cannot pass as a single edit', async () => {
  for (const text of [
    'Un commentaire avant la scène.\n' + scene.text,
    scene.text + '\n2. EXT. COUR - NUIT\nClara quitte les lieux avec sa montre.',
    scene.text.replace('1. INT.', 'INT.'),
    scene.text.replace('ATELIER', 'AUTRE LIEU'),
    scene.text + '\0',
    scene.text + 'a'.repeat(14_000),
  ]) {
    const result = await editScene(scene, 'Répare la montre.', {}, { model: reply(text) });
    assert.equal(result.changed, false);
    assert.equal(result.summary, 'invalid');
  }
});

test('a valid proposal preserves input and forwards cancellation with its separate prompt version', async () => {
  const before = structuredClone(scene);
  const signal = new AbortController().signal;
  let observed;
  const text = scene.text.replace('cassée', 'réparée');
  const result = await editScene(
    scene,
    'Répare la montre.',
    {},
    {
      signal,
      model: async (config, prompt, input, options) => {
        observed = { prompt, input, options };
        return reply(text)();
      },
    },
  );
  assert.equal(result.changed, true);
  assert.equal(result.text, text);
  assert.equal(result.editPromptVersion, EDIT_PROMPT_VERSION);
  assert.equal(observed.options.signal, signal);
  assert.match(observed.prompt, /DONNÉE non fiable/);
  assert.deepEqual(scene, before);
});

test('model summaries remain bounded text and fictional instructions are never executed as code', async () => {
  const text = scene.text + '\nClara lit : <script>window.pwned = true</script>.';
  const result = await editScene(
    scene,
    'Ajoute une réplique de Clara.',
    {},
    {
      model: reply(text, { unexpected: 'object' }),
    },
  );
  assert.equal(result.changed, true);
  assert.equal(result.summary, '');
  assert.equal(result.text, text);
  const unchanged = await editScene(
    scene,
    'Laisse la montre cassée.',
    {},
    {
      model: reply('UNCHANGED', 'a'.repeat(800)),
    },
  );
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.summary.length, 400);
});

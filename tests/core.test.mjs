import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScreenplay, locateQuote } from '../src/core/parser.js';
import { retrieve, chunkScenes } from '../src/core/retrieval.js';
import {
  validateExtraction,
  findCandidates,
  mergeObjects,
  answerQuestion,
  analyze,
} from '../src/core/pipeline.js';
import { parseModelJSON, modelConfig } from '../src/core/model.js';
const two = `1. INT. ATELIER - JOUR\nALICE\nLa montre argentée tombe. Le verre de la montre est brisé.\n2. EXT. COUR - JOUR - CONTINU\nALICE\nAlice regarde la même montre. Son verre est intact.`;
test('recognizes numbered screenplay headers and preserves PDF page provenance', () => {
  const { scenes } = parseScreenplay({
    pages: [
      { page: 2, text: '1) INT. ATELIER - DAY\nALICE\nAlice entre dans la pièce.' },
      {
        page: 3,
        text: 'Une lampe rouge éclaire la table.\n2) EXT. COUR - NIGHT\nALICE\nElle prend un taxi.',
      },
    ],
  });
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes[0].pages, [2, 3]);
  assert.equal(locateQuote(scenes[0], 'Une lampe rouge éclaire la table.').page, 3);
  assert.equal(locateQuote(scenes[0], 'Une lampe bleue éclaire la table.'), null);
});
test('documents without scene headers produce an explicit warning', () => {
  const result = parseScreenplay(
    'Une longue description sans format de scénario. Alice cherche une lettre dans une pièce vide.',
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(result.scenes.length, 1);
});
test('rejects scanned/empty documents and too-large text', () => {
  assert.throws(() => parseScreenplay('  '), /court|scanné/);
  assert.throws(() => parseScreenplay('x'.repeat(180001)), /180 000/);
});
test('unverifiable quotes and forged scene IDs never become facts', () => {
  const scenes = parseScreenplay(two).scenes;
  const result = validateExtraction(
    {
      objects: [
        {
          name: 'montre',
          aliases: [],
          mentions: [
            {
              sceneId: 'S001',
              quote: 'La montre était bleue et parfaitement neuve.',
              state: 'intact',
            },
            { sceneId: 'S999', quote: 'Le verre de la montre est brisé.', state: 'broken' },
          ],
        },
      ],
    },
    scenes,
  );
  assert.equal(result.objects.length, 0);
  assert.equal(result.rejected, 2);
});
test('explicit incompatible states yield a candidate, an explicit repair cancels it', () => {
  const scenes = parseScreenplay(two).scenes;
  const object = {
    id: 'O1',
    name: 'montre',
    aliases: ['montre'],
    mentions: [
      {
        sceneId: 'S001',
        quote: 'Le verre de la montre est brisé.',
        state: 'broken',
        action: 'break',
        owner: 'Alice',
      },
      {
        sceneId: 'S002',
        quote: 'Son verre est intact.',
        state: 'intact',
        action: 'observe',
        owner: 'Alice',
      },
    ],
  };
  assert.equal(findCandidates([object], scenes).length, 1);
  object.mentions[1].action = 'repair';
  assert.equal(findCandidates([object], scenes).length, 0);
});
test('a missing mention alone is never treated as an error', () => {
  const scenes = parseScreenplay(two).scenes;
  assert.equal(
    findCandidates(
      [
        {
          id: 'O1',
          name: 'montre',
          aliases: [],
          mentions: [
            { sceneId: 'S001', state: 'broken', quote: 'Le verre de la montre est brisé.' },
          ],
        },
      ],
      scenes,
    ).length,
    0,
  );
});
test('objects are not merged just because they share a generic alias', () => {
  const items = ['téléphone de Léa', 'téléphone de Marc'].map((name) => ({
    name,
    aliases: ['phone'],
    mentions: [],
  }));
  assert.equal(mergeObjects(items, []).length, 2);
});
test('generic cigarettes owned by unrelated characters stay separate physical objects', () => {
  const items = ['Runa', 'Leila'].map((owner) => ({
    name: 'cigarette',
    aliases: [],
    mentions: [
      {
        sceneId: owner === 'Runa' ? 'S001' : 'S002',
        owner,
        action: 'light',
        state: 'present',
        quote: owner + ' lights a cigarette.',
      },
    ],
  }));
  assert.equal(mergeObjects(items, parseScreenplay(two).scenes).length, 2);
});
test('retrieval stays within the supplied document and returns existing scene IDs', () => {
  const scenes = parseScreenplay(two).scenes;
  assert.equal(retrieve(scenes, 'montre brisée')[0].sceneId, 'S001');
  assert.deepEqual(retrieve(scenes, 'astronaute satellite'), []);
  assert.ok(retrieve(scenes, 'montre', { sceneIds: ['S002'] }).every((s) => s.sceneId === 'S002'));
});
test('QA discards invented citations even when the model sounds confident', async () => {
  const result = await answerQuestion(
    parseScreenplay(two).scenes,
    'montre',
    {},
    {
      model: async () => ({
        data: { answer: 'Elle est intacte [S999-C1]', citations: ['S999-C1'] },
        usage: {},
      }),
    },
  );
  assert.equal(result.answer, 'NOT FOUND');
  assert.deepEqual(result.citations, []);
});
test('JSON parsing handles code fences but refuses prose, arrays, and truncated JSON', () => {
  assert.deepEqual(parseModelJSON('```json\n{"objects":[]}\n```'), { objects: [] });
  assert.throws(() => parseModelJSON('Je pense que tout va bien.'));
  assert.throws(() => parseModelJSON('[1,2]'));
  assert.throws(() => parseModelJSON('{"objects":['));
});
test('hosted inference cannot be redirected to arbitrary local endpoints', () => {
  assert.throws(() => modelConfig({ GROQ_API_KEY: 'test' }, 'ollama'), /local/);
  assert.equal(
    modelConfig({ GROQ_API_KEY: 'test' }, 'groq').baseUrl,
    'https://api.groq.com/openai/v1/chat/completions',
  );
  assert.throws(() => modelConfig({ GROQ_API_KEY: 'test' }, 'groq', '../../.env'), /invalide/);
});

test('retrieval preserves a phrase across a chunk boundary and never combines different scenes', () => {
  const phrase = 'boussole ancienne disparue';
  const scenes = [
    {
      id: 'S001',
      heading: 'INT. ATELIER',
      pages: [2],
      text: 'a'.repeat(985) + ' ' + phrase + '\n' + 'Suite du dialogue. '.repeat(60),
    },
    {
      id: 'S002',
      heading: 'EXT. COUR',
      pages: [3],
      text: 'Un parapluie violet se trouve dans la cour.',
    },
  ];
  const chunks = chunkScenes(scenes);
  assert.ok(chunks.some((chunk) => chunk.text.includes(phrase)));
  assert.ok(
    chunks
      .filter((chunk) => chunk.sceneId === 'S001')
      .every((chunk) => !chunk.text.includes('parapluie')),
  );
  assert.equal(retrieve(scenes, phrase)[0].sceneId, 'S001');
});

test('the judge cannot replace validated quotes or introduce a candidate that was never generated', async () => {
  const scenes = parseScreenplay(two).scenes;
  const quotes = ['Le verre de la montre est brisé.', 'Son verre est intact.'];
  let calls = 0;
  const fakeModel = async () => {
    calls++;
    const data =
      calls === 1
        ? {
            objects: [
              {
                name: 'montre',
                aliases: [],
                mentions: [
                  {
                    sceneId: 'S001',
                    quote: quotes[0],
                    state: 'broken',
                    owner: 'Alice',
                    action: 'break',
                  },
                  {
                    sceneId: 'S002',
                    quote: quotes[1],
                    state: 'intact',
                    owner: 'Alice',
                    action: 'observe',
                  },
                ],
              },
            ],
          }
        : {
            results: [
              {
                candidateId: 'CAN001',
                verdict: 'contradiction',
                title: 'Verre de la montre',
                evidence: [{ sceneId: 'S999', quote: 'Une preuve inventée.' }],
              },
              { candidateId: 'CAN999', verdict: 'contradiction', title: 'Candidat inventé' },
            ],
          };
    return { data, usage: { inputTokens: 1, outputTokens: 1, milliseconds: 1 } };
  };
  const result = await analyze(
    scenes,
    { provider: 'groq', model: 'test-model' },
    { model: fakeModel },
  );
  assert.equal(calls, 2);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(
    result.alerts[0].evidence.map((evidence) => evidence.quote),
    quotes,
  );
  assert.deepEqual(
    result.alerts[0].evidence.map((evidence) => evidence.sceneId),
    ['S001', 'S002'],
  );
});

test('editScene returns a proposal only when the heading survives, and never mutates the scene', async () => {
  const { editScene } = await import('../src/core/pipeline.js');
  const scene = {
    id: 'S001',
    heading: 'INT. CUISINE - JOUR',
    text: 'INT. CUISINE - JOUR\nClara pose sa montre cassée.',
  };
  const reply = (data) => async () => ({ data, usage: {} });
  const ok = await editScene(
    scene,
    'répare la montre',
    {},
    {
      model: reply({ text: 'INT. CUISINE - JOUR\nClara pose sa montre réparée.', summary: 'ok' }),
    },
  );
  assert.equal(ok.changed, true);
  const noHeading = await editScene(
    scene,
    'x y z',
    {},
    { model: reply({ text: 'Clara sourit.', summary: '' }) },
  );
  assert.deepEqual([noHeading.changed, noHeading.summary], [false, 'invalid']);
  const same = await editScene(
    scene,
    'x y z',
    {},
    { model: reply({ text: 'UNCHANGED', summary: 'hors sujet' }) },
  );
  assert.equal(same.changed, false);
  assert.match(scene.text, /cassée/);
});

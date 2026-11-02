import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroqPacer, durationMilliseconds } from '../eval/rate-pacing.mjs';

test('Groq token reset durations support documented compound units', () => {
  assert.equal(durationMilliseconds('1m2.5s'), 62500);
  assert.equal(durationMilliseconds('7.66s'), 7660);
  assert.equal(durationMilliseconds(null), 0);
});

test('evaluation pacing waits for the token reset without changing the model request', async () => {
  let time = 1000;
  let calls = 0;
  const sleeps = [];
  const original = {
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Texte inchangé' }] }),
  };
  const fetcher = createGroqPacer({
    now: () => time,
    sleep: async (value) => {
      sleeps.push(value);
      time += value;
    },
    fetcher: async (url, options) => {
      assert.equal(options, original);
      calls++;
      return Response.json(
        { usage: { prompt_tokens: 10 } },
        { headers: { 'x-ratelimit-remaining-tokens': '1', 'x-ratelimit-reset-tokens': '2s' } },
      );
    },
  });
  await fetcher('https://api.groq.com/example', original);
  await fetcher('https://api.groq.com/example', original);
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [2050]);
});

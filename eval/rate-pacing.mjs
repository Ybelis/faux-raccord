// Les en-têtes Groq décrivent les tokens par minute, pas le quota journalier.
// Cette couche ralentit le transport sans changer les textes ni la notation.
export function durationMilliseconds(value = '') {
  let total = 0;
  for (const match of String(value).matchAll(/([\d.]+)(ms|s|m|h)/g)) {
    total += Number(match[1]) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[match[2]];
  }
  return total;
}

function pause(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, milliseconds);
    function finish() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

export function createGroqPacer({
  fetcher = fetch,
  now = Date.now,
  sleep = pause,
  onWait = () => {},
} = {}) {
  let remaining = null;
  let resetAt = 0;
  let tokensPerCharacter = 0.3;
  return async (url, options) => {
    const body = JSON.parse(options.body);
    const characters = JSON.stringify(body.messages).length;
    const estimate = Math.ceil(characters * tokensPerCharacter) + 128;
    if (remaining !== null && estimate > remaining && resetAt > now()) {
      const milliseconds = resetAt - now() + 50;
      onWait(milliseconds);
      // Une pause reste interruptible ; aucune période d'attente ne dépasse 60 s.
      while (resetAt > now()) await sleep(Math.min(60000, resetAt - now() + 50), options.signal);
    }
    const response = await fetcher(url, options);
    const budget = response.headers.get('x-ratelimit-remaining-tokens');
    remaining = budget !== null && Number.isFinite(Number(budget)) ? Number(budget) : null;
    resetAt = now() + durationMilliseconds(response.headers.get('x-ratelimit-reset-tokens'));
    if (response.ok) {
      const data = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (characters && data.usage?.prompt_tokens) {
        tokensPerCharacter = Math.max(tokensPerCharacter, data.usage.prompt_tokens / characters);
      }
    }
    return response;
  };
}

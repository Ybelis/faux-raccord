// A transport profile for the free Groq quota. It changes request size,
// never the extraction/judgment prompts or the cited source passages.
export const CONTINUITY_PROFILE = Object.freeze({
  id: 'continuity-free-v1',
  extractionBatchSize: 3,
  extractionMaxOutputTokens: 3000,
  judgmentMaxOutputTokens: 1000,
  judgmentCandidatesPerRequest: 2,
});

export function withContinuityProfile(baseModel, { onProgress = () => {} } = {}) {
  if (typeof baseModel !== 'function') throw new TypeError('A model function is required.');
  const stats = { logicalCalls: 0, physicalCalls: 0 };

  async function run(config, prompt, user, options = {}) {
    const judgment = Array.isArray(user?.candidates);
    const ceiling = judgment
      ? CONTINUITY_PROFILE.judgmentMaxOutputTokens
      : CONTINUITY_PROFILE.extractionMaxOutputTokens;
    const configured = config.settings?.maxOutputTokens ?? 5000;
    // Preserve a smaller user budget. Keep undefined options when the model's
    // configured budget already fits: this also preserves evaluation cache keys.
    if (options.maxTokens !== undefined || configured > ceiling)
      options = {
        ...options,
        maxTokens: Math.min(options.maxTokens ?? configured, configured, ceiling),
      };

    if (judgment && user.candidates.length > CONTINUITY_PROFILE.judgmentCandidatesPerRequest) {
      const responses = [];
      for (
        let offset = 0;
        offset < user.candidates.length;
        offset += CONTINUITY_PROFILE.judgmentCandidatesPerRequest
      ) {
        const candidates = user.candidates.slice(
          offset,
          offset + CONTINUITY_PROFILE.judgmentCandidatesPerRequest,
        );
        onProgress({
          stage: 'compare',
          message: `Jugement : candidats ${offset + 1}–${offset + candidates.length} du lot.`,
        });
        responses.push(await run(config, prompt, { ...user, candidates }, options));
      }
      const usage = {
        ...responses[0].usage,
        calls: responses.length,
        inputTokens: 0,
        outputTokens: 0,
        milliseconds: 0,
      };
      for (const response of responses)
        for (const field of ['inputTokens', 'outputTokens', 'milliseconds'])
          usage[field] += response.usage[field] || 0;
      return {
        data: { results: responses.flatMap((response) => response.data.results || []) },
        usage,
      };
    }
    stats.physicalCalls++;
    return baseModel(config, prompt, user, options);
  }

  const wrapped = (...args) => {
    stats.logicalCalls++;
    return run(...args);
  };
  wrapped.stats = stats;
  wrapped.profile = CONTINUITY_PROFILE;
  return wrapped;
}

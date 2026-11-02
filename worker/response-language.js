// Le profil français évalué reste intact. Le suffixe anglais est un profil
// distinct : il ne transforme jamais une analyse enregistrée ni ses citations.
export const ENGLISH_LANGUAGE_PROFILE = 'english-output-v1';
export const ENGLISH_OUTPUT_INSTRUCTION =
  '\n\nOUTPUT LANGUAGE PROFILE english-output-v1: Write user-facing prop descriptions, alert titles, explanations, questions and answers in English. Keep proper names, JSON keys, state/action enums and scene/citation IDs unchanged. Copy source quotations verbatim in their original language; never translate or paraphrase evidence. Preserve the exact NOT FOUND sentinel when required.';

export function responseLanguage(value = 'fr') {
  if (!['fr', 'en'].includes(value)) throw new Error('Langue invalide : choisissez fr ou en.');
  return value;
}

export function withResponseLanguage(model, language) {
  if (responseLanguage(language) === 'fr') return model;
  return (configuration, prompt, input, options) =>
    model(configuration, prompt + ENGLISH_OUTPUT_INSTRUCTION, input, options);
}

export function languageMetadata(language) {
  return {
    responseLanguage: language,
    languageProfile: language === 'en' ? ENGLISH_LANGUAGE_PROFILE : 'french-original-v1',
  };
}

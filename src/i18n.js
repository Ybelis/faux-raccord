import app from './locales/en-app.js';
import workspace from './locales/en-workspace.js';
import secondary from './locales/en-secondary.js';

export const LANGUAGE_KEY = 'faux-raccord:language';
export const LANGUAGES = Object.freeze({ fr: 'Français', en: 'English' });
export const localeTag = (language) => (language === 'en' ? 'en-GB' : 'fr-FR');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const english = Object.fromEntries(
  Object.entries({ ...secondary, ...workspace, ...app }).map(([key, value]) => [
    normalize(key),
    value,
  ]),
);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Seuls les textes explicitement marqués par t() sont traduits. Les scénarios,
// citations et réponses enregistrées ne passent jamais par ce dictionnaire.
const patterns = Object.entries(english)
  .filter(([key]) => /\{\w+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\w+\}/g, '').length - a.replace(/\{\w+\}/g, '').length)
  .map(([key, value]) => {
    const names = [...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    const parts = key.split(/\{\w+\}/g).map(escapeRegExp);
    return { expression: new RegExp('^' + parts.join('(.+?)') + '$'), names, value };
  });
const interpolate = (text, values) =>
  text.replace(/\{(\w+)\}/g, (token, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : token,
  );

export function translate(text, language = 'fr', values = {}) {
  if (typeof text !== 'string') return text;
  if (language !== 'en') return interpolate(text, values);
  const key = normalize(text);
  let result = Object.hasOwn(english, key) ? english[key] : undefined;
  if (result === undefined) {
    for (const pattern of patterns) {
      const match = key.match(pattern.expression);
      if (match) {
        result = interpolate(
          pattern.value,
          Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])),
        );
        break;
      }
    }
  }
  if (result === undefined) return interpolate(text, values);
  return (
    (text.match(/^\s+/)?.[0] || '') + interpolate(result, values) + (text.match(/\s+$/)?.[0] || '')
  );
}

export function readLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export function saveLanguage(language) {
  const next = language === 'en' ? 'en' : 'fr';
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {}
  return next;
}

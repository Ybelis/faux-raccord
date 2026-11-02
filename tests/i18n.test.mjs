import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_KEY, localeTag, readLanguage, saveLanguage, translate } from '../src/i18n.js';
import { guideChapters } from '../data/project-guide.js';
import { guideChaptersEn } from '../data/project-guide.en.js';

test('English labels and complete parameterised sentences preserve values and whitespace', () => {
  assert.equal(translate('Analyse', 'en'), 'Analysis');
  assert.equal(translate('Analyser {count} scènes', 'en', { count: 12 }), 'Analyse 12 scenes');
  assert.equal(translate('  Analyser 12 scènes \n', 'en'), '  Analyse 12 scenes \n');
  assert.equal(translate('Analyser {count} scènes', 'fr', { count: 12 }), 'Analyser 12 scènes');
  assert.equal(translate('Analyser {count} scènes', 'de', { count: 12 }), 'Analyser 12 scènes');
  assert.equal(translate('Analyser {count} scènes', 'en'), 'Analyse {count} scenes');
  // Inserted values are data: braces inside a value must not trigger another substitution.
  assert.equal(
    translate('Analyser {count} scènes', 'en', { count: '{other}', other: 3 }),
    'Analyse {other} scenes',
  );
});

test('locale tags and preformatted counts use the chosen language without changing the value', () => {
  assert.equal(localeTag('en'), 'en-GB');
  assert.equal(localeTag('fr'), 'fr-FR');
  assert.equal(localeTag('unsupported'), 'fr-FR');
  const englishCount = new Intl.NumberFormat(localeTag('en')).format(12345);
  const frenchCount = new Intl.NumberFormat(localeTag('fr')).format(12345);
  assert.equal(translate('{count} scènes', 'en', { count: englishCount }), '12,345 scenes');
  assert.equal(translate('{count} scènes', 'fr', { count: frenchCount }), `${frenchCount} scènes`);
  assert.equal(
    new Intl.NumberFormat(localeTag('en'), { maximumFractionDigits: 1 }).format(46.7),
    '46.7',
  );
  assert.equal(
    new Intl.NumberFormat(localeTag('fr'), { maximumFractionDigits: 1 }).format(46.7),
    '46,7',
  );
});

test('language preference persists only allowed values and survives unavailable browser storage', (context) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
  assert.equal(readLanguage(), 'fr');
  assert.equal(saveLanguage('en'), 'en');
  assert.equal(storage.get(LANGUAGE_KEY), 'en');
  assert.equal(readLanguage(), 'en');
  storage.set(LANGUAGE_KEY, 'invalid');
  assert.equal(readLanguage(), 'fr');
  assert.equal(saveLanguage('invalid'), 'fr');
  assert.equal(storage.get(LANGUAGE_KEY), 'fr');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Storage blocked');
    },
  });
  assert.equal(readLanguage(), 'fr');
  assert.equal(saveLanguage('en'), 'en');
});

test('both documentation editions retain the same chapters, tables and actual evidence URLs', () => {
  assert.deepEqual(
    guideChaptersEn.map((chapter) => chapter.id),
    ['utiliser', 'fonctionnement', 'evaluation', 'limites'],
  );
  assert.deepEqual(
    guideChaptersEn.map((chapter) => chapter.id),
    guideChapters.map((chapter) => chapter.id),
  );
  assert.equal(guideChaptersEn[0].title, 'Using Faux Raccord');
  for (const [index, french] of guideChapters.entries()) {
    const english = guideChaptersEn[index];
    assert.equal(english.sections.length, french.sections.length, french.id);
    for (const [sectionIndex, source] of french.sections.entries()) {
      const target = english.sections[sectionIndex];
      for (const key of ['paragraphs', 'bullets', 'links'])
        assert.equal(
          target[key]?.length ?? 0,
          source[key]?.length ?? 0,
          `${french.id}/${sectionIndex}/${key}`,
        );
      assert.deepEqual(
        target.links?.map((link) => link.href),
        source.links?.map((link) => link.href),
      );
      if (source.table) {
        assert.equal(target.table.columns.length, source.table.columns.length);
        assert.deepEqual(
          target.table.rows.map((row) => row.length),
          source.table.rows.map((row) => row.length),
        );
      }
      assert.equal(typeof target.code, typeof source.code);
    }
  }
  const results = guideChaptersEn.find((chapter) => chapter.id === 'evaluation');
  assert.ok(
    results.sections
      .flatMap((section) => section.links || [])
      .some(
        (link) => link.href === '/docs/print/evaluation.pdf' && link.label.includes('(French)'),
      ),
  );
});

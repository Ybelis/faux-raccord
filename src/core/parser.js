export const MAX_CHARS = 180_000;

// Une même phrase peut contenir accents, espaces de PDF et apostrophes
// typographiques différents. On compare une copie normalisée ; le texte
// original reste conservé pour la lecture et les preuves affichées.
export function fold(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADER =
  /^(?:(\d{1,3})[.)]?\s+)?\.?((?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.?|EXT\.?|I\/E|INTERIEUR|EXTERIEUR|INTÉRIEUR|EXTÉRIEUR)(?:\s|\.|\/|-).*)$/i;
const EXCLUDED =
  /^(?:FADE|CUT|DISSOLVE|CLOSE|ANGLE|CONTINUED|CONTINUOUS|MONTAGE|SERIES|INSERT|BLACK|END|SCENE|SCÈNE|THE END|VALKAAMA|ACT|TITLE|SUPER|POV|V\.O|O\.S|INT|EXT|VOIX OFF|FONDU|FIN)/;

export function guessCharacters(text) {
  // Heuristique d'affichage : les répliques portent souvent un nom en capitales.
  // Cette liste n'est pas une extraction de personnages validée par le modèle.
  return [
    ...new Set(
      text
        .split('\n')
        .map((s) => s.trim().replace(/\s*\((?:V\.?O\.?|O\.?S\.?|CONT.?D|OFF).*\)$/i, ''))
        .filter(
          (s) =>
            s.length > 1 && s.length < 35 && /^[A-ZÀ-Ý][A-ZÀ-Ý '\-]+$/.test(s) && !EXCLUDED.test(s),
        ),
    ),
  ];
}

export function parseScreenplay(input) {
  const pages = typeof input === 'string' ? [{ page: 1, text: input }] : input.pages;
  if (!Array.isArray(pages) || !pages.length)
    throw new Error('Le document ne contient aucun texte exploitable.');
  const clean = pages.map((p) => ({
    page: Number(p.page) || 1,
    text: String(p.text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u0000/g, ''),
  }));
  let full = '',
    pageRanges = [];
  // Les intervalles relient les positions du texte assemblé aux pages du PDF.
  // Une scène peut traverser plusieurs pages : son numéro ne sert donc jamais
  // de numéro de page. Pour un fichier texte, la page 1 est une convention.
  for (const p of clean) {
    pageRanges.push({ start: full.length, end: full.length + p.text.length, page: p.page });
    full += p.text + '\n\n';
  }
  if (full.length > MAX_CHARS)
    throw new Error('Ce prototype accepte au maximum 180 000 caractères. Importez un extrait.');
  if (full.trim().length < 30)
    throw new Error(
      'Texte trop court ou PDF scanné. Importez un PDF avec du texte sélectionnable.',
    );
  const lines = full.split('\n');
  const starts = [];
  let offset = 0;
  for (const raw of lines) {
    // Les espaces sont simplifiés seulement pour reconnaître les en-têtes.
    // Les offsets restent calculés sur les lignes brutes, sinon les extraits
    // et leurs pages se décaleraient après un import PDF.
    const line = raw.trim().replace(/[ \t]+/g, ' ');
    const match = line.match(HEADER);
    const montage = line.match(
      /^(\d{1,3})[.)]\s+\*?\s*(VARIOUS SCENES|MONTAGE|SÉQUENCE|SEQUENCE).*$/i,
    );
    if ((match && line.length < 170) || montage)
      starts.push({ offset, heading: line, number: match?.[1] || montage?.[1] });
    offset += raw.length + 1;
  }
  const warnings = [];
  if (!starts.length) {
    // Sans en-têtes reconnus, le découpage de secours reste explicite et doit
    // être vérifié. Il ne prétend pas reconstruire les scènes d'un PDF scanné.
    warnings.push(
      'Aucun en-tête INT./EXT. reconnu : découpage en séquences textuelles. Vérifiez les limites des scènes.',
    );
    let at = 0;
    for (const block of full.split(/\n\s*\n/)) {
      if (block.trim() && (starts.length === 0 || at - starts.at(-1).offset > 1600))
        starts.push({ offset: at, heading: `Séquence ${starts.length + 1}` });
      at += block.length + 2;
    }
  }
  const scenes = starts
    .map((s, i) => {
      const end = starts[i + 1]?.offset ?? full.length;
      const text = full.slice(s.offset, end).trim();
      const matchedPages = pageRanges
        .filter((p) => p.end > s.offset && p.start < end)
        .map((p) => p.page);
      const time =
        s.heading.match(
          /(?:\b|[-–])\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|JOUR|NUIT|MATIN|SOIR|AUBE|CRÉPUSCULE)\s*(?:#?\d*#?)?$/i,
        )?.[1] || 'Non précisé';
      const pageSegments = pageRanges
        .filter((p) => matchedPages.includes(p.page))
        .map((p) => ({
          page: p.page,
          text: full.slice(Math.max(p.start, s.offset), Math.min(p.end, end)),
        }));
      return {
        id: `S${String(i + 1).padStart(3, '0')}`,
        index: i,
        number: s.number || String(i + 1),
        heading: s.heading,
        text,
        pages: matchedPages,
        pageSegments,
        time,
        location: s.heading
          .replace(/^\d+[.)]?\s*/, '')
          .replace(/^(INT\.?|EXT\.?|INTERIEUR|EXTERIEUR|INTÉRIEUR|EXTÉRIEUR)[\s./-]*/i, '')
          .replace(new RegExp(`\\s*[-–]\\s*${time}.*$`, 'i'), '')
          .trim(),
        characters: guessCharacters(text),
        temporal: /FLASHBACK|RETOUR EN ARRIÈRE/i.test(text) ? 'flashback' : 'unknown',
      };
    })
    .filter((s) => s.text.length > 15);
  return {
    scenes,
    warnings,
    characterCount: full.length,
    pageCount: clean.length,
    text: full.trim(),
  };
}

export function locateQuote(scene, quote) {
  // Le modèle propose une citation, mais seule sa présence dans la scène
  // autorise son utilisation comme preuve. Ce contrôle vérifie le passage,
  // pas l'interprétation de l'état ou du propriétaire donnée par le modèle.
  const q = fold(quote);
  if (q.length < 12 || q.length > 700) return null;
  const start = fold(scene.text).indexOf(q);
  // On cherche d'abord la citation dans les segments de page. Si elle traverse
  // une coupure de page, son début aide à retrouver la page de départ.
  const page =
    scene.pageSegments?.find((p) => fold(p.text).includes(q))?.page ||
    scene.pageSegments?.find((p) => fold(p.text).includes(q.slice(0, 24)))?.page ||
    scene.pages[0] ||
    1;
  return start < 0 ? null : { sceneId: scene.id, quote: String(quote).trim(), page };
}

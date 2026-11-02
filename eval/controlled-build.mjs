import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseScreenplay } from '../src/core/parser.js';

// This fixture is an openly labelled adaptation of ONE real screenplay.
// First add coherent prop continuity, then change exactly 15 later sentences.
// The published original remains untouched; gold annotations never enter prompts.
const specs = [
  [
    'E01',
    1,
    2,
    'brass pocket watch',
    'Runa',
    'broken',
    'intact',
    'Runa drops her brass pocket watch. Its glass breaks and its mechanism stops.',
    'Runa holds the same brass pocket watch, still broken and stopped.',
    'Runa checks the same brass pocket watch: its glass is intact and its mechanism works. Nobody has repaired or replaced it.',
  ],
  [
    'E02',
    1,
    2,
    'red notebook',
    'Lasse',
    'destroyed',
    'intact',
    'Lasse burns his red notebook completely. Only ashes remain.',
    'Lasse carries only the ashes of his destroyed red notebook.',
    'Lasse opens the same red notebook, intact with all its original pages. No replacement has been obtained.',
  ],
  [
    'E03',
    1,
    2,
    'yellow flask',
    'Ibsy',
    'empty',
    'full',
    'Ibsy empties her yellow flask completely and screws its cap back on.',
    'Ibsy shakes her yellow flask; it is still completely empty.',
    'Ibsy pours water from her same yellow flask, now completely full. It has not been refilled.',
  ],
  [
    'E04',
    1,
    2,
    'folded street map',
    'Lasse',
    'lost',
    'present',
    "A gust carries Lasse's folded street map into the river. It sinks out of reach and is lost.",
    'Lasse searches his pocket; his folded street map is still missing.',
    'Lasse unfolds his same folded street map. He has neither recovered it nor obtained a replacement.',
  ],
  [
    'E05',
    4,
    5,
    'silver wristwatch',
    'Leila',
    'broken',
    'intact',
    'Leila drops her silver wristwatch. The glass shatters and the hands stop.',
    'Leila sets down her silver wristwatch, still broken and stopped.',
    'Leila checks her same silver wristwatch: the glass is intact and the hands work. Nobody has repaired or replaced it.',
  ],
  [
    'E06',
    4,
    5,
    'blue cigarette case',
    'Magnus',
    'empty',
    'full',
    'Magnus takes the last cigarette from his blue cigarette case; the case is completely empty.',
    'Magnus opens his blue cigarette case; it is still empty.',
    'Magnus opens his same blue cigarette case; it is completely full of cigarettes. Nobody has refilled it.',
  ],
  [
    'E07',
    4,
    5,
    'green medicine vial',
    'Magnus',
    'destroyed',
    'intact',
    'Magnus crushes his green medicine vial under his heel. The vial is destroyed into tiny fragments.',
    'Magnus sweeps up the fragments of his destroyed green medicine vial.',
    'Magnus sets his same green medicine vial on the table, intact and unbroken. No replacement has been obtained.',
  ],
  [
    'E08',
    4,
    5,
    'red coin purse',
    'Leila',
    'lost',
    'present',
    'Leila accidentally drops her red coin purse down the sealed ventilation shaft. It is lost and unreachable.',
    'Leila checks her bag; her red coin purse is still missing.',
    'Leila holds her same red coin purse. She has neither recovered it from the shaft nor obtained a replacement.',
  ],
  [
    'E09',
    7,
    11,
    'black coffee thermos',
    'Runa',
    'empty',
    'full',
    'Runa pours out every last drop from her black coffee thermos. It is completely empty.',
    'Runa holds her black coffee thermos; it has remained empty since breakfast.',
    'Runa pours coffee from her same black coffee thermos, now completely full. Nobody has refilled it since breakfast.',
  ],
  [
    'E10',
    7,
    11,
    'green reading glasses',
    'Lasse',
    'broken',
    'intact',
    'Lasse snaps both arms off his green reading glasses and cracks both lenses.',
    'Lasse puts his green reading glasses in his pocket, still broken since breakfast.',
    'Lasse wears his same green reading glasses, with intact arms and lenses. They have not been repaired or replaced since breakfast.',
  ],
  [
    'E11',
    7,
    11,
    'navy passport holder',
    'Runa',
    'destroyed',
    'intact',
    'Runa cuts her navy passport holder into tiny pieces and burns the pieces to ash.',
    'Runa brushes away the ashes of her destroyed navy passport holder.',
    'Runa opens her same navy passport holder, completely intact. No replacement has been obtained since breakfast.',
  ],
  [
    'E12',
    8,
    9,
    'brown hip flask',
    'Magnus',
    'empty',
    'full',
    'Magnus drains his brown hip flask completely. Not a drop remains inside.',
    'Magnus opens his brown hip flask; it is still completely empty.',
    'Magnus drinks from his same brown hip flask, now completely full. Nobody has refilled it.',
  ],
  [
    'E13',
    8,
    9,
    'copper fountain pen',
    'Magnus',
    'broken',
    'intact',
    'Magnus drops his copper fountain pen. Its nib breaks off and it can no longer write.',
    'Magnus examines his copper fountain pen; the nib is still broken off.',
    'Magnus writes with his same copper fountain pen; its nib is intact. Nobody has repaired or replaced it.',
  ],
  [
    'E14',
    8,
    9,
    'steel memory key',
    'Magnus',
    'destroyed',
    'intact',
    'Magnus crushes his steel memory key with a hammer until its casing and circuit are destroyed.',
    'Magnus collects the destroyed fragments of his steel memory key.',
    'Magnus plugs in his same steel memory key, its casing and circuit intact and working. No replacement has been obtained.',
  ],
  [
    'E15',
    8,
    9,
    'rear-door keyring',
    'Magnus',
    'lost',
    'present',
    'Magnus drops his rear-door keyring through a drain grate. It falls out of reach and is lost.',
    'Magnus checks his pocket; his rear-door keyring is still missing.',
    'Magnus takes his same rear-door keyring from his pocket. He has neither recovered it nor obtained a replacement.',
  ],
  [
    'N01',
    1,
    2,
    'white toy car',
    'Ibsy',
    'broken',
    'intact',
    "Ibsy's white toy car loses a wheel and cannot roll.",
    "Lasse repairs Ibsy's white toy car by firmly replacing its wheel. The repaired car rolls normally.",
    null,
  ],
  [
    'N02',
    4,
    5,
    'amber drinking bottle',
    'Leila',
    'empty',
    'full',
    'Leila drinks the last water in her amber drinking bottle. It is completely empty.',
    'Leila refills her amber drinking bottle with water from the tap. The bottle is now completely full.',
    null,
  ],
  [
    'N03',
    7,
    11,
    'small silver compass',
    'Runa',
    'broken',
    'intact',
    "Runa's small silver compass falls onto the kitchen floor. Its glass cracks.",
    'Runa repairs her small silver compass by fitting a spare glass. The compass is now intact.',
    null,
  ],
  [
    'N04',
    8,
    9,
    'white water bottle',
    'Magnus',
    'empty',
    'full',
    'Magnus empties his white water bottle completely.',
    'Magnus refills his white water bottle at the kitchen tap. The bottle is now full.',
    null,
  ],
];

export async function buildControlledScript({ directory = 'data/controlled-script' } = {}) {
  const originalBytes = await readFile('data/valkaama.json');
  const original = JSON.parse(originalBytes);
  const originalScenes = parseScreenplay(original).scenes;
  const rows = specs.map(
    ([id, before, after, object, owner, beforeState, afterState, setup, reference, injected]) => ({
      id,
      kind: injected ? 'injected-error' : 'negative-control',
      object,
      owner,
      beforeSceneId: `S${String(before).padStart(3, '0')}`,
      afterSceneId: `S${String(after).padStart(3, '0')}`,
      beforeState,
      afterState,
      setup,
      reference,
      injected,
    }),
  );
  function adaptedPages(corrupted) {
    const pages = structuredClone(original.pages);
    for (const scene of originalScenes) {
      const additions = rows.flatMap((row) => [
        ...(row.beforeSceneId === scene.id ? [row.setup] : []),
        ...(row.afterSceneId === scene.id
          ? [corrupted && row.injected ? row.injected : row.reference]
          : []),
      ]);
      if (!additions.length) continue;
      const page = pages.find((p) => p.text.includes(scene.heading + '\n'));
      if (!page) throw new Error(`Source heading not found: ${scene.id}`);
      page.text = page.text.replace(
        scene.heading + '\n',
        scene.heading + '\n' + additions.join('\n') + '\n',
      );
    }
    return pages;
  }
  const common = {
    ...original,
    title: 'Valkaama — atelier de continuité',
    description:
      'Adaptation contrôlée pour évaluer Faux Raccord : accessoires ajoutés artificiellement à un seul scénario réel. Ce ne sont pas des erreurs attribuées au scénario original.',
    synthetic: true,
    controlled: true,
    adaptationAuthors: 'Équipe Faux Raccord, avec assistance de génération de code et de texte',
    provenance: {
      type: 'controlled-adaptation',
      baseProjectId: original.id,
      originalSha256: createHash('sha256').update(originalBytes).digest('hex'),
      preparation:
        '19 accessoires et leurs transitions ajoutés au texte source ; puis 15 phrases ultérieures modifiées dans la version injectée.',
      modificationsSynthetic: true,
      pageMeaning:
        'Numéros des pages du PDF original servant de repères de placement. Les phrases ajoutées ne figurent pas dans ce PDF.',
      evaluatedSceneIds: originalScenes.slice(0, 12).map((s) => s.id),
      fullSceneCount: originalScenes.length,
    },
  };
  const reference = {
    ...common,
    id: 'controlled-valkaama-reference',
    controlledInjectionCount: 0,
    pages: adaptedPages(false),
  };
  const project = {
    ...common,
    id: 'controlled-valkaama',
    controlledInjectionCount: 15,
    pages: adaptedPages(true),
  };
  const scenes = parseScreenplay(project).scenes;
  const annotations = {
    id: 'controlled-valkaama-v1',
    version: 1,
    role: 'development-controlled-benchmark',
    annotationStatus: 'machine-authored-proposed-for-human-review',
    scriptId: project.id,
    referenceScriptId: reference.id,
    evaluationSceneIds: common.provenance.evaluatedSceneIds,
    injectionCount: 15,
    negativeControlCount: 4,
    limitations: [
      'Un seul scénario, erreurs artificielles explicites : ne mesure pas la performance sur tous les scénarios réels.',
      'Jeu de développement visible ; ne constitue pas un test aveugle indépendant.',
      'Seuls les 19 accessoires ajoutés sont annotés. Les autres alertes sont à relire et exclues de la précision contrôlée.',
      'Les intervalles de Wilson sont descriptifs : les 15 observations appartiennent au même scénario et ne sont pas indépendantes.',
    ],
    entries: rows.map((row) => {
      const originalScene = originalScenes.find((s) => s.id === row.afterSceneId);
      const beforeScene = scenes.find((s) => s.id === row.beforeSceneId);
      const afterScene = scenes.find((s) => s.id === row.afterSceneId);
      return {
        errorId: row.id,
        kind: row.kind,
        object: row.object,
        owner: row.owner,
        objectAliases: [row.object],
        expectedAlert: Boolean(row.injected),
        expectedStates: { before: row.beforeState, after: row.afterState },
        reason: row.injected
          ? `Le même accessoire passe de ${row.beforeState} à ${row.afterState} sans réparation, remplacement, récupération ni remplissage, explicitement exclus.`
          : 'La réparation ou le remplissage est explicitement raconté ; aucune alerte attendue.',
        before: { sceneId: beforeScene.id, sourcePages: beforeScene.pages, quote: row.setup },
        after: {
          sceneId: afterScene.id,
          sourcePages: afterScene.pages,
          quote: row.injected || row.reference,
        },
        edit: {
          operation: row.injected ? 'replace-prepared-sentence' : 'unchanged-negative-control',
          originalScriptPassage: originalScene.text.slice(0, 220),
          originalScriptContainsAddedProp: false,
          insertionAnchor: originalScene.heading,
          sourcePage: originalScene.pages[0],
          preparedSentence: row.reference,
          adaptedSentence: row.injected || row.reference,
        },
      };
    }),
  };
  const license = {
    originalTitle: 'Valkaama',
    originalAuthor: 'Tim Baumann',
    basedOn: 'Novel by Hendrik Behnisch',
    originalVersion: original.version,
    originalSourceUrl: original.sourceUrl,
    originalDownloadUrl: original.downloadUrl,
    originalLocalFile: 'data/valkaama.json',
    originalPdf: 'data/raw/valkaama-en.pdf',
    originalSha256: common.provenance.originalSha256,
    license: 'CC BY-SA 3.0',
    licenseUrl: original.licenseUrl,
    verification: {
      date: '2026-11-02',
      url: original.sourceUrl,
      section: 'Script',
      result:
        'La page officielle annonce explicitement la licence Creative Commons Attribution-ShareAlike 3.0 pour le scénario et propose le PDF anglais.',
    },
    adaptationNotice:
      'Les accessoires et phrases listés dans annotations.json ont été ajoutés ou modifiés pour un exercice pédagogique par l’équipe Faux Raccord avec assistance IA. Les scènes originales et leurs auteurs restent crédités. Cette adaptation est partagée sous CC BY-SA 3.0. Ne pas attribuer les faux raccords injectés aux auteurs originaux.',
    attribution:
      'Valkaama (scénario, version 2007-06-30), Tim Baumann, d’après le roman de Hendrik Behnisch, https://www.valkaama.com/index.php?l=en&page=sources, CC BY-SA 3.0. Adaptation de continuité : équipe Faux Raccord (2026), modifications synthétiques documentées, même licence.',
  };
  await mkdir(directory, { recursive: true });
  for (const [file, value] of Object.entries({
    'project.json': project,
    'reference.json': reference,
    'annotations.json': annotations,
    'license.json': license,
  })) {
    await writeFile(`${directory}/${file}`, JSON.stringify(value, null, 2) + '\n');
  }
  return { project, reference, annotations, license };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { annotations } = await buildControlledScript();
  console.log(
    JSON.stringify(
      {
        script: annotations.scriptId,
        injections: annotations.injectionCount,
        negativeControls: annotations.negativeControlCount,
        evaluatedScenes: annotations.evaluationSceneIds.length,
      },
      null,
      2,
    ),
  );
}

import { parseScreenplay } from '../src/core/parser.js';
import { analyze } from '../src/core/pipeline.js';
import { EXTRACT_PROMPT } from '../src/core/prompts.js';

// Démonstration du CODE, sans fournisseur ni clé. Les sorties du modèle sont
// des fixtures annoncées : ce script ne mesure pas la qualité de l'IA.
const original = `1. INT. ATELIER - JOUR
Alice laisse tomber sa montre argentée. Le verre de sa montre est brisé.

2. EXT. COUR - JOUR - CONTINU
Alice regarde la même montre argentée. Son verre est intact.`;
const { scenes } = parseScreenplay(original);
console.log('EXEMPLE PÉDAGOGIQUE — sorties de modèle simulées, zéro appel réseau.');
console.log('\n1. Le parseur découpe le texte :');
console.log(scenes.map((scene) => `${scene.id} : ${scene.heading}`).join('\n'));

async function exampleModel(config, prompt) {
  const usage = { inputTokens: 0, outputTokens: 0, milliseconds: 0 };
  if (prompt === EXTRACT_PROMPT)
    return {
      usage,
      data: {
        objects: [
          {
            name: 'montre argentée d’Alice',
            aliases: ['montre argentée'],
            mentions: scenes.map((scene, index) => ({
              sceneId: scene.id,
              quote: scene.text.split('\n').slice(1).join('\n').trim(),
              state: index ? 'intact' : 'broken',
              owner: 'Alice',
              action: index ? 'observe' : 'break',
              temporal: 'continuous',
            })),
          },
        ],
      },
    };
  return {
    usage,
    data: {
      results: [
        {
          candidateId: 'CAN001',
          verdict: 'contradiction',
          title: 'La montre apparaît intacte après sa casse',
          explanation:
            'Les deux scènes décrivent le même objet et aucune réparation n’est mentionnée.',
          question: 'Une réparation ou un changement de montre manque-t-il dans le texte ?',
        },
      ],
    },
  };
}

const result = await analyze(
  scenes,
  { provider: 'teaching-fixture', model: 'simulation-explicite' },
  {
    model: exampleModel,
    audit(event) {
      if (event.stage !== 'extract') return;
      console.log('\n2. Une sortie JSON de modèle est fournie comme fixture.');
      console.log('3. Le code recherche les citations dans les scènes :');
      console.log(JSON.stringify(event.validated, null, 2));
    },
  },
);

console.log('\n4. Le code regroupe les mentions et crée les candidats :');
console.log(
  JSON.stringify(
    { accessories: result.objects.length, candidates: result.candidateCount },
    null,
    2,
  ),
);
console.log('\n5. Le juge simulé confirme un point, mais les preuves viennent toujours du texte :');
console.log(
  JSON.stringify(
    result.alerts.map((alert) => ({
      title: alert.title,
      evidence: alert.evidence,
      status: alert.status,
    })),
    null,
    2,
  ),
);
console.log(
  '\n6. Le statut pending signifie : un membre de l’équipe doit encore relire et décider.',
);
console.log('Guide du code : http://127.0.0.1:4173/#/docs/fonctionnement');

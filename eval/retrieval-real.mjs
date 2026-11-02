import { readFile, writeFile } from 'node:fs/promises';
import { parseScreenplay, fold } from '../src/core/parser.js';
import { retrieve } from '../src/core/retrieval.js';
const corpus=JSON.parse(await readFile('data/valkaama.json','utf8'));
const scenes=parseScreenplay(corpus).scenes;
const examples=[
['Runa cigarette park','S001','Runa lights a cigarette.'],
['Lasse crinkled paper cafe','S002','a piece of crinkled paper'],
['Leila purse pepper spray','S004','pepper spray can be seen inside'],
['Leila glass Scotch full','S005','It is still full.'],
['Runa laptop turned on','S006','her laptop which is still turned on'],
['Runa candle kitchen','S006','an almost burnt down candle'],
['radio pop music breakfast','S007','The radio plays pop music.'],
['Magnus vodka cupboard','S008','half-full bottle of vodka in his cupboard'],
['Magnus LAZARUS alias','S009','His alias is LAZARUS.'],
['Runa money cafe table','S002','She puts some money on the table'],
['Ibsy chocolate cake','S001','chocolate cake?'],
['Magnus Leila paid advance money','S004','money which Magnus apparently paid in advance.']
];
const rows=examples.map(([question,expectedSource,expectedQuote],i)=>{
 const scene=scenes.find(s=>s.id===expectedSource);
 if(!fold(scene.text).includes(fold(expectedQuote)))throw new Error(`Reference quote not found: ${expectedSource}, ${expectedQuote}`);
 const retrieved=retrieve(scenes,question,{topK:5});
 return{id:`R${String(i+1).padStart(3,'0')}`,question,expectedSource,expectedQuote,synthetic:false,annotationStatus:'source-quote-verified; student-review-pending',retrieved:retrieved.map(r=>r.sceneId),hit:retrieved.some(r=>r.sceneId===expectedSource)};
});
const report={corpus:'Valkaama',license:corpus.license,n:rows.length,metric:'scene recall@5',value:rows.filter(r=>r.hit).length/rows.length,completedAt:new Date().toISOString(),note:'Recherche lexicale seule, pas exactitude des réponses du LLM. Les citations de référence ont été contrôlées dans le texte ; validation étudiante encore à réaliser.',rows};
await writeFile('eval/retrieval-real.json',JSON.stringify(report,null,2));console.log(JSON.stringify({n:report.n,recallAt5:report.value,misses:rows.filter(r=>!r.hit).map(r=>r.id)},null,2));

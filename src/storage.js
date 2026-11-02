const DB_NAME = 'faux-raccord-studio';
let opening;
function database() {
  return opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveProject(project) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put({ ...project, savedAt: new Date().toISOString() });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
export async function allProjects() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('projects').objectStore('projects').getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export function downloadFile(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportMarkdown(project) {
  const a = project.analysis;
  return `# Faux Raccord — ${project.title}\n\nDate : ${new Date().toLocaleString('fr-FR')}\n\n` +
    `Source : ${project.sourceUrl || project.filename || 'Import utilisateur'}\nLicence : ${project.license}\n` +
    `Données synthétiques : ${project.synthetic ? 'oui' : 'non'}\n\n` +
    (a ? `Modèle : ${a.model} (${a.provider}), prompt ${a.promptVersion}\nScènes analysées : ${a.analyzedSceneIds.length}/${project.scenes.length}\nAccessoires : ${a.objects.length}\n\n` +
      a.alerts.map((alert, i) => `## ${i + 1}. ${alert.title}\n\nStatut : ${alert.status}\n\n${alert.description}\n\n` + alert.evidence.map(e => `> ${e.quote.replace(/\n/g, ' ')}\n\nSource : ${e.sceneId}, page ${e.page}`).join('\n\n') + (alert.note ? `\n\nNote de revue : ${alert.note}` : '')).join('\n\n') +
      `\n\n## Limites\n\nLes alertes sont des points à vérifier, pas des erreurs avérées. L'analyse porte sur le texte et ne détecte pas les faux raccords visuels. Les citations ont été vérifiées par correspondance textuelle ; l'interprétation doit être relue.\n` : 'Aucune analyse disponible.');
}

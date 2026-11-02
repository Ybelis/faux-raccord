export default {
  'Commencer avec Faux Raccord': 'Get started with Faux Raccord',
  'L’outil aide à repérer les changements d’accessoires qui méritent une relecture dans un scénario.':
    'Find prop changes in a screenplay that deserve a closer look.',
  'Importez votre fichier ou choisissez un scénario de la bibliothèque.':
    'Import your file or choose a screenplay from the library.',
  'Lancer une analyse': 'Run an analysis',
  'Choisissez les scènes et le moteur Groq ou Ollama.':
    'Choose the scenes and a Groq or Ollama model.',
  'Relire les points signalés': 'Review the flagged points',
  'Comparez les citations, prenez une décision et exportez votre travail.':
    'Compare the quotations, record your decision and export your work.',
  'Essayer le guide interactif · 2 minutes': 'Try the interactive guide · 2 minutes',
  'Ouvrir directement le projet': 'Go straight to the project',
  'Ouvrir un scénario': 'Open a screenplay',
  'Les projets sont conservés dans ce navigateur. L’export JSON permet de les partager avec le groupe.':
    'Projects are saved in this browser. Export a JSON file to share them with your team.',
  'Importer un fichier': 'Import a file',
  'Chercher dans la bibliothèque': 'Search the library',
  'PDF avec texte, TXT, Fountain, Markdown ou projet JSON · 5 Mo maximum.':
    'Text-based PDF, TXT, Fountain, Markdown or project JSON · 5 MB maximum.',
  'Exemples disponibles': 'Available examples',
  '{count} scènes': '{count} scenes',
  'Vos autres projets': 'Your other projects',
  'Analyse disponible': 'Analysis available',
  'À analyser': 'Not analysed yet',
  'Bibliothèque de scénarios': 'Screenplay library',
  'Consultez la provenance et les conditions d’utilisation avant d’importer un document.':
    'Check the source and terms of use before importing a document.',
  'Ces réglages s’appliquent aux prochaines analyses et questions. Les résultats enregistrés conservent leur configuration d’origine.':
    'These settings apply to new analyses and questions. Recorded results keep their original configuration.',
  'Revenir au projet': 'Return to the project',
  'Exporter le travail': 'Export your work',
  'Le projet complet conserve le scénario, la provenance, les résultats et les décisions de relecture.':
    'A complete project includes the screenplay, provenance, results and review decisions.',
  'Projet complet · JSON': 'Complete project · JSON',
  'À partager puis réimporter dans Faux Raccord.': 'Share it and import it back into Faux Raccord.',
  'Rapport de continuité · Markdown': 'Continuity report · Markdown',
  'Les points signalés, leurs citations et vos décisions.':
    'Flagged points, their quotations and your decisions.',
  'L’export contient le texte du scénario. Ses conditions de redistribution restent applicables.':
    'The export contains the screenplay text. Its redistribution terms still apply.',
  'Le serveur ne répond pas.': 'The server is not responding.',
  'Où exécuter l’analyse ?': 'Where should the analysis run?',
  'Fournisseur du modèle': 'Model provider',
  'API distante · clé sur le serveur': 'Remote API · key stored on the server',
  'Modèles installés sur votre machine': 'Models installed on your computer',
  'Disponible avec le lancement local': 'Available when running locally',
  'Les scènes sélectionnées sont envoyées à Groq lors de l’analyse. Le catalogue ne reçoit aucun texte du scénario.':
    'Selected scenes are sent to Groq during analysis. Browsing the catalogue sends no screenplay text.',
  'Le serveur contacte votre installation Ollama. Aucun scénario n’est envoyé à Groq.':
    'The server contacts your Ollama installation. No screenplay is sent to Groq.',
  'Ajoutez GROQ_API_KEY au fichier .env du serveur, puis redémarrez le projet.':
    'Add GROQ_API_KEY to the server’s .env file, then restart the project.',
  'Lancez le projet sur votre ordinateur pour utiliser Ollama.':
    'Run the project on your computer to use Ollama.',
  'Modèles du catalogue Groq': 'Groq model catalogue',
  'Modèles installés': 'Installed models',
  'Chargement du catalogue…': 'Loading the catalogue…',
  'Choisir un modèle': 'Choose a model',
  'Aucun modèle chargé': 'No models loaded',
  'Actualiser les modèles': 'Refresh models',
  Actualiser: 'Refresh',
  'Identifiant du modèle': 'Model identifier',
  'Vous pouvez saisir un identifiant absent de la liste. Le test ci-dessous vérifie la connexion et une réponse JSON ; il ne garantit pas la qualité de l’analyse.':
    'You can enter an identifier that is not listed. The test below checks the connection and a JSON response; it does not establish analysis quality.',
  'La liste reflète les modèles installés sur le serveur. Elle ne constitue pas une sélection validée pour l’extraction d’accessoires. Consultez les profils et leurs limites dans Documentation → Données et fonctionnement.':
    'This list reflects the models installed on the server. They have not all been validated for prop extraction. See Documentation → Data and method for profiles and limitations.',
  'Éditeur :': 'Publisher:',
  'Contexte annoncé :': 'Advertised context:',
  'Paramètres :': 'Parameters:',
  'Quantification :': 'Quantisation:',
  'Poids :': 'Weights:',
  Go: 'GB',
  'Réglages avancés': 'Advanced settings',
  'Les réglages effectifs accompagnent chaque analyse. Les scores enregistrés concernent uniquement le modèle, les paramètres et le profil indiqués dans leur rapport.':
    'Each analysis records its effective settings. Recorded scores apply only to the model, settings and profile specified in that report.',
  Température: 'Temperature',
  '0 · par défaut': '0 · default',
  '0 réduit la variation des réponses, sans assurer un résultat identique.':
    '0 reduces response variation, without guaranteeing identical results.',
  'Sortie maximale par appel': 'Maximum output per call',
  ' · par défaut': ' · default',
  'L’analyse Groq borne l’extraction à 3 000 tokens et la comparaison à 1 000, par groupes de deux candidats. Une limite plus basse reste appliquée.':
    'Groq analysis caps extraction at 3,000 tokens and comparison at 1,000, with two candidates per request. A lower limit is still respected.',
  'Une limite basse peut couper le JSON. La comparaison et les questions gardent des plafonds plus courts.':
    'A low limit can truncate the JSON. Comparison and questions keep their shorter limits.',
  'Effort de raisonnement': 'Reasoning effort',
  'Faible · par défaut': 'Low · default',
  Moyen: 'Medium',
  Élevé: 'High',
  'GPT-OSS uniquement. Un effort plus élevé peut augmenter les tokens et le temps d’attente.':
    'GPT-OSS only. A higher effort may increase token use and waiting time.',
  'Contexte Ollama': 'Ollama context',
  'Doit tenir dans la mémoire disponible et respecter les capacités du modèle. Un contexte trop court peut tronquer les scènes.':
    'Must fit the available memory and the model’s capabilities. Too little context can truncate scenes.',
  'Rétablir les réglages par défaut': 'Restore default settings',
  'Vérification en cours…': 'Checking…',
  'Tester la connexion et le JSON': 'Test connection and JSON',
  'Ce bouton envoie une courte requête au modèle. Sur Groq, elle compte dans votre quota. Aucun passage du scénario n’est transmis.':
    'This sends a short request to the model. On Groq, it counts towards your quota. No screenplay passage is sent.',
  'Réponse JSON vérifiée en {seconds} s · {tokens} tokens. La qualité de l’analyse reste à évaluer.':
    'JSON response verified in {seconds} s · {tokens} tokens. Analysis quality still needs to be evaluated.',
  'La bibliothèque ne répond pas.': 'The library is not responding.',
  'Source de scénarios': 'Screenplay source',
  '2 200 films': '2,200 films',
  'Disponible hors ligne': 'Available offline',
  'Cherchez un titre ou un identifiant IMDb parmi les 2 200 films. Cet index est disponible hors ligne ; l’aperçu et l’import du scénario nécessitent une connexion.':
    'Search by title or IMDb ID among 2,200 films. The index is available offline; previewing and importing a screenplay requires a connection.',
  'Rechercher dans MovieSum': 'Search MovieSum',
  'Titre du film ou identifiant IMDb…': 'Film title or IMDb ID…',
  Rechercher: 'Search',
  Collection: 'Collection',
  'Collection MovieSum': 'MovieSum collection',
  'Tous les films · 2 200': 'All films · 2,200',
  'Principale · 1 800 films': 'Main · 1,800 films',
  'Validation · 200 films': 'Validation · 200 films',
  'Test · 200 films': 'Test · 200 films',
  '{count} résultat': '{count} result',
  '{count} résultats': '{count} results',
  ' pour « {query} »': ' for “{query}”',
  'Voir la source': 'View source',
  'Films disponibles': 'Available films',
  'Aperçu du scénario': 'Screenplay preview',
  'APERÇU DU TEXTE': 'TEXT PREVIEW',
  'Chargement de l’aperçu…': 'Loading the preview…',
  'Aperçu indisponible :': 'Preview unavailable:',
  'Le début des textes longs est importé dans la limite de 60 séquences et 180 000 caractères. La portée exacte reste indiquée dans le projet. Les repères correspondent aux scènes XML, pas aux pages originales.':
    'Long screenplays are imported from the beginning, up to 60 sequences and 180,000 characters. The exact coverage is recorded in the project. Locators refer to XML scenes, not original pages.',
  'J’ai pris connaissance des conditions de réutilisation de MovieSum.':
    'I have read MovieSum’s reuse terms.',
  'Importer ce scénario': 'Import this screenplay',
  'Ce texte est tronqué par la source. Son import est indisponible.':
    'This text is truncated by the source and cannot be imported.',
  'Aucun résultat dans cette collection. Essayez un autre mot ou une autre collection.':
    'No results in this collection. Try another search term or collection.',
  Précédent: 'Previous',
  'Aucun résultat': 'No results',
  Suivant: 'Next',
  '{start}–{end} sur {total}': '{start}–{end} of {total}',
  'La source indique des résultats partiels. Le nombre de résultats peut évoluer.':
    'The source reports partial results. The result count may change.',
  'Conditions de réutilisation': 'Reuse terms',
  '. Licence annoncée du jeu de données :': '. Declared dataset licence:',
  'Publication des auteurs': 'Authors’ publication',
  'SCÉNARIO PUBLIÉ PAR SON AUTEUR': 'SCREENPLAY PUBLISHED BY ITS AUTHOR',
  'Tim Baumann, d’après le roman de Hendrik Behnisch. Version anglaise du 30 juin 2007, 56 scènes. Le texte et les repères du PDF sont fournis avec le projet.':
    'Tim Baumann, based on Hendrik Behnisch’s novel. English version dated 30 June 2007, 56 scenes. The text and PDF locators are included with the project.',
  'Analyse fournie': 'Included analysis',
  '10 premières scènes · résultat enregistré': 'First 10 scenes · recorded result',
  Attribution: 'Attribution',
  'Conservée dans le projet et ses exports': 'Preserved in the project and its exports',
  'Les adaptations de ce texte doivent conserver l’attribution et respecter le partage dans les mêmes conditions.':
    'Adaptations must preserve attribution and comply with the share-alike terms.',
  'Page de l’auteur': 'Author’s page',
  'Ouvrir Valkaama': 'Open Valkaama',
  '1. Partir du texte': '1. Start with the text',
  'Voici Les Heures Creuses, un exemple fictif de 12 scènes. Choisissez une scène dans la liste pour lire son texte. Ce guide utilise une copie séparée : votre projet reste intact.':
    'This is Les Heures Creuses, a fictional 12-scene example. Choose a scene from the list to read it. The guide uses a separate copy, leaving your project intact.',
  '2. Comprendre le résultat': '2. Understand the result',
  'Une analyse de cet exemple a déjà été exécutée. Elle extrait les accessoires, suit leurs états et compare les changements. Le nombre de scènes analysées indique exactement ce qui a été couvert.':
    'This example has already been analysed. The analysis extracts props, tracks their states and compares changes. The analysed-scene count shows exactly what was covered.',
  '3. Comparer les passages': '3. Compare the passages',
  'Chaque point rapproche deux citations du scénario. Lisez-les : un changement peut être voulu. Le lien sous chaque citation permet de retrouver la scène complète.':
    'Each point brings together two screenplay quotations. Read them: a change may be intentional. The link below each quotation opens the full scene.',
  '4. Prendre une décision': '4. Record a decision',
  'Ajoutez une note si nécessaire, puis confirmez ou écartez ce point. Cela enregistre votre avis ; le modèle ne décide pas à votre place.':
    'Add a note if needed, then confirm or dismiss the point. This records your judgement; the model does not decide for you.',
  '5. Conserver le travail': '5. Keep your work',
  'Le projet est sauvegardé dans ce navigateur. Le bouton Exporter permet de transmettre le projet complet en JSON ou un rapport lisible. Vous pouvez maintenant revenir à votre scénario.':
    'The project is saved in this browser. Export the complete project as JSON or a readable report. You can now return to your screenplay.',
  'PRISE EN MAIN ·': 'GETTING STARTED ·',
  'Quitter le guide': 'Exit guide',
  'Pour continuer, choisissez « Confirmer le point » ou « Écarter ».':
    'To continue, choose “Confirm point” or “Dismiss”.',
  'Revenir à mon projet': 'Return to my project',
  Fermer: 'Close',
  'La licence annoncée concerne le jeu de données. Elle ne garantit pas les droits sur chaque scénario de film. Vérifiez votre usage avant une analyse externe ou une redistribution.':
    'The declared licence covers the dataset. It does not guarantee rights to every film screenplay. Check your intended use before sending text to an external model or redistributing it.',
  'Partition MovieSum inconnue.': 'Unknown MovieSum split.',
  'La source a renvoyé une réponse vide.': 'The source returned an empty response.',
  'MovieSum est momentanément inaccessible. Réessayez ou utilisez le scénario Valkaama disponible hors ligne.':
    'MovieSum is temporarily unavailable. Try again or use the Valkaama screenplay available offline.',
  'La bibliothèque limite les requêtes. Patientez avant de réessayer.':
    'The library is rate-limiting requests. Wait before trying again.',
  'La bibliothèque MovieSum ne répond pas correctement. Les exemples locaux restent disponibles.':
    'The MovieSum library is not responding correctly. Local examples remain available.',
  'La réponse MovieSum est incomplète ou illisible.':
    'The MovieSum response is incomplete or unreadable.',
  'Le format de MovieSum a changé. Aucun scénario n’a été importé.':
    'The MovieSum format has changed. No screenplay was imported.',
  'Le catalogue source a changé. Actualisez l’index MovieSum avant d’importer ce film.':
    'The source catalogue has changed. Refresh the MovieSum index before importing this film.',
  'Identifiant IMDb invalide.': 'Invalid IMDb ID.',
  'Ce scénario n’a pas été retrouvé dans MovieSum.': 'This screenplay was not found in MovieSum.',
  'Ce film ne contient pas de scénario exploitable.':
    'This film does not contain a usable screenplay.',
  'Hugging Face a tronqué ce scénario. Il n’est pas importé pour éviter de présenter un texte incomplet comme complet.':
    'Hugging Face truncated this screenplay. It was not imported to avoid presenting incomplete text as complete.',
  'Structure XML non prise en charge.': 'Unsupported XML structure.',
  'Aucune scène XML reconnue dans ce scénario MovieSum.':
    'No XML scenes were recognised in this MovieSum screenplay.',
  'Aucune scène exploitable dans ce scénario.': 'No usable scenes in this screenplay.',
  'Origine de requête non autorisée.': 'Request origin is not allowed.',
  'Seul le catalogue MovieSum configuré est autorisé.':
    'Only the configured MovieSum catalogue is allowed.',
  'La recherche est limitée à 100 caractères.': 'Search is limited to 100 characters.',
  'Source d’import non autorisée.': 'Import source is not allowed.',
  'Confirmez avoir pris connaissance des conditions de réutilisation.':
    'Confirm that you have read the reuse terms.',
  'Évaluation non exécutée.': 'Evaluation has not been run.',
  'Format des scènes invalide.': 'Invalid scene format.',
  'Scénario introuvable.': 'Screenplay not found.',
  'Route introuvable.': 'Route not found.',
  'Le fichier dépasse la limite de 5 Mo.': 'The file exceeds the 5 MB limit.',
  'Importez un fichier PDF, TXT ou Fountain de moins de 5 Mo.':
    'Import a PDF, TXT or Fountain file smaller than 5 MB.',
  'PDF trop long : 160 pages maximum.': 'The PDF is too long: 160 pages maximum.',
  'Formats acceptés : PDF avec texte, TXT, Fountain et Markdown.':
    'Accepted formats: text-based PDF, TXT, Fountain and Markdown.',
  'Requête trop volumineuse.': 'The request is too large.',
  'La requête doit contenir un objet JSON.': 'The request must contain a JSON object.',
  'La requête d’import est trop volumineuse.': 'The import request is too large.',
  'La réponse de la source dépasse la limite autorisée.':
    'The source response exceeds the allowed size limit.',
  'Page invalide.': 'Invalid page.',
  'Identifiant du film invalide.': 'Invalid film identifier.',
  'MovieSum ne fournit pas les pages du scénario original. Les repères numériques désignent les scènes XML, pas des pages PDF.':
    'MovieSum does not provide the original screenplay pages. Numeric locators refer to XML scenes, not PDF pages.',
  'Extrait importé : début du scénario, limité à {count} séquences et 180 000 caractères. Le texte source comporte {total} scènes XML.':
    'Imported excerpt: the beginning of the screenplay, limited to {count} sequences and 180,000 characters. The source text contains {total} XML scenes.',
  'Des scènes XML très longues ont été divisées en parties numérotées pour respecter la limite du moteur.':
    'Very long XML scenes have been split into numbered parts to respect the model’s limits.',
  'Route de bibliothèque introuvable.': 'Library route not found.',
  'La bibliothèque est momentanément indisponible.': 'The library is temporarily unavailable.',
  'Les réglages du modèle sont invalides.': 'Invalid model settings.',
  'Réglage invalide : {name}.': 'Invalid setting: {name}.',
  'Niveau de raisonnement invalide.': 'Invalid reasoning effort.',
  'Fournisseur inconnu.': 'Unknown provider.',
  'Ollama est disponible avec le lancement local du projet.':
    'Ollama is available when the project runs locally.',
  'Nom du modèle invalide.': 'Invalid model name.',
  'Ollama est inaccessible. Démarrez Ollama sur le serveur local, puis actualisez la liste.':
    'Ollama is unreachable. Start Ollama on the local server, then refresh the list.',
  'Le catalogue Groq est inaccessible. Réessayez ou saisissez un identifiant de modèle.':
    'The Groq catalogue is unreachable. Try again or enter a model identifier.',
  'La clé Groq est refusée.': 'The Groq key was rejected.',
  'Le catalogue de modèles est temporairement indisponible.':
    'The model catalogue is temporarily unavailable.',
  'La présence dans le catalogue ne garantit pas la qualité de l’extraction. Testez le JSON avant une analyse.':
    'Being listed does not guarantee extraction quality. Test the JSON response before running an analysis.',
  'Le modèle a renvoyé un JSON invalide. Relancez l’analyse.':
    'The model returned invalid JSON. Run the analysis again.',
  'Le fournisseur a refusé la requête ({status}, {code}).':
    'The provider rejected the request ({status}, {code}).',
  'Le moteur n’a pas répondu dans le délai prévu. Réessayez ou choisissez un modèle plus léger.':
    'The model did not respond in time. Try again or choose a smaller model.',
  'Analyse interrompue.': 'Analysis stopped.',
  'Le moteur IA ne répond pas. Vérifiez sa connexion.':
    'The AI model is not responding. Check its connection.',
  'Le modèle répond, mais il n’a pas respecté le format JSON attendu.':
    'The model responded but did not follow the expected JSON format.',
  'Connexion et réponse JSON vérifiées. Ce test court ne mesure pas la qualité de l’analyse.':
    'Connection and JSON response verified. This short test does not measure analysis quality.',
  'Le document ne contient aucun texte exploitable.': 'The document contains no usable text.',
  'Ce prototype accepte au maximum 180 000 caractères. Importez un extrait.':
    'This prototype accepts up to 180,000 characters. Import an excerpt.',
  'Texte trop court ou PDF scanné. Importez un PDF avec du texte sélectionnable.':
    'The text is too short or the PDF is scanned. Import a PDF with selectable text.',
  'Aucun en-tête INT./EXT. reconnu : découpage en séquences textuelles. Vérifiez les limites des scènes.':
    'No INT./EXT. headings were recognised: the text was divided into sequences. Check the scene boundaries.',
  'Ce fichier ne correspond pas à un projet Faux Raccord valide.':
    'This file is not a valid Faux Raccord project.',
};

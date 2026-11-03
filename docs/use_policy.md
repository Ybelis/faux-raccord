# Politique d'utilisation

Faux Raccord aide à relire la continuité textuelle d'accessoires d'un scénario.
Les utilisateurs visés sont les scriptes et les petites équipes de tournage.
Les alertes sont des points à examiner, jamais une preuve définitive d'erreur.

L’import accepte un seul PDF avec texte, TXT, Fountain ou Markdown de 5 Mo au
maximum. Le serveur compte les octets reçus, contrôle l’extension, le type annoncé
et le contenu, puis limite le texte à 180 000 caractères, 200 scènes et 14 000
caractères par scène. Les textes doivent être en UTF-8. Les noms de fichier ne
servent jamais de chemins sur le serveur ; les documents HTML et binaires déguisés
sont refusés. Aucun appel à un modèle n’est déclenché par l’import.

Les PDF sont limités à 160 pages et lus dans un thread Node séparé. La lecture
est interrompue après 20 secondes ou lors de l’annulation ; deux lectures sont
autorisées simultanément. Les scripts PDF détectés sont refusés, et seuls les
textes sont extraits : les images, liens et pièces jointes ne sont ni affichés ni
ouverts. Les limites de mémoire V8 ne couvrent pas toute la mémoire native et
ne constituent pas une isolation du système d’exploitation. Ces protections
réduisent les risques de saturation sans garantir l’innocuité de tout PDF.

Un projet JSON est traité comme une donnée non fiable : taille et profondeur
bornées, structure et références contrôlées, liens de source limités à HTTP ou
HTTPS sans identifiants, propriétés dangereuses refusées. Une restauration crée
une nouvelle copie pour préserver les projets existants. Les noms d’auteurs,
licences, sources et résultats déclarés dans ce fichier ne sont pas des preuves
d’authenticité ; la présence des citations valide leur correspondance au texte,
pas leur interprétation.

Importer uniquement des textes que l'équipe a le droit d'utiliser. Une analyse
ou une question avec Groq envoie les scènes sélectionnées ou les extraits utiles
à ce fournisseur. Pour des textes
confidentiels ou sans autorisation de transfert, choisir Ollama dans la version
locale. L'envoi au modèle correspond à une action de l'utilisateur ; le produit
ne publie pas le scénario et n'envoie pas de message à un tiers de façon autonome.

Un import MovieSum dépend des conditions du jeu et des droits des œuvres
sous-jacentes. La licence déclarée du dataset et la confirmation de lecture
dans l'interface ne garantissent pas une autorisation de réutilisation de chaque
scénario. L'équipe vérifie l'utilisation prévue et conserve la provenance.

Chaque alerte doit avoir deux citations présentes dans les scènes. Un résultat
sans preuve est rejeté. Les instructions incluses dans les scénarios sont des
données, pas des instructions pour le système. Les sorties du modèle ne sont
jamais exécutées comme code ou HTML.

L’édition envoie une seule scène au modèle après accord explicite. La proposition
doit conserver son en-tête et rester une scène unique. Son application est une
action humaine et crée une nouvelle copie sans analyse ; le projet original et
ses décisions sont conservés. Les instructions présentes dans le texte restent
des données non fiables, y compris lorsqu’elles imitent un rôle système.

Les instructions système définissent la tâche. Les scènes et les noms ou alias
déjà extraits sont transmis dans un message de données distinct. Cette séparation
et les consignes de refus réduisent le risque de détournement sans le supprimer :
une injection peut modifier un état ou un verdict tout en citant un passage réel.
Le modèle ne reçoit aucune clé serveur et ne dispose d’aucun outil d’exécution.
Le profil de réponse `grounded-output-v1` impose des citations dans le texte,
cohérentes avec les sources annoncées, ou une abstention `NOT FOUND`.

L'utilisateur confirme ou écarte les alertes et peut joindre une note. Il doit
vérifier l'identité de l'objet, les ellipses et les intentions de mise en scène.
Une absence de mention ne permet pas d'affirmer une disparition.

Hors périmètre : analyse vidéo, contrôle du montage, qualification juridique
des droits, planification fiable d'un tournage ou évaluation du talent d'un
auteur. Ne pas utiliser les scores synthétiques comme garantie sur un film réel.

Les projets sont stockés sur l'appareil. L'équipe doit exporter les fichiers
pour les sauvegarder ou les transmettre ; il n'y a pas de synchronisation
collaborative. Les clés API restent dans l'environnement serveur, jamais dans
le dépôt, les projets exportés ou les réponses du modèle.

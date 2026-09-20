# XIV Dye Tools — Guide de confidentialité (application web)

> Ceci est une traduction fournie à titre pratique. La version anglaise fait foi ; en cas de divergence, c'est elle qui prévaut. [Anglais](PRIVACY.md)

**Dernière mise à jour :** 2026-09-20 · Couvre **xivdyetools.app** et **beta.xivdyetools.app**. Le bot
Discord a sa propre politique : [`apps/discord-worker/PRIVACY_POLICY.md`](../discord-worker/PRIVACY_POLICY.md).

XIV Dye Tools fonctionne dans votre navigateur. Les outils de couleur — l'Extracteur de palette,
l'Explorateur d'harmonies, la Comparaison de Teintures, le Constructeur de Dégradé, le
Mélangeur de Teintures, la Vérification d'accessibilité, les Suggestions Budget et le Nuancier —
effectuent leur travail sur votre appareil. Rien de ce que vous importez, choisissez ou saisissez
n'est envoyé où que ce soit, sauf si une section ci-dessous le précise, et les sections ci-dessous
en forment la liste complète.

## Images et captures d'appareil photo

- Les images importées, collées, glissées-déposées et capturées par l'appareil photo ne quittent
  jamais votre appareil, et ne sont jamais écrites dans le stockage du navigateur. Elles sont lues
  avec l'API Canvas du navigateur, conservées dans la mémoire de la page pour cette session
  uniquement, et supprimées lorsque vous effacez l'image, fermez l'onglet ou rechargez la page.
- L'Extracteur de palette affiche la même chose à l'endroit où vous choisissez un fichier —
  « Les images sont lues dans votre navigateur et jamais envoyées », à côté d'un cadenas. Cet avis
  est un texte simple, pas un lien ; ce document est accessible depuis **À propos → Confidentialité**.

## Fichiers de personnage (`.chara`)

- Un fichier `.chara` (Anamnesis, Ktisis, Brio) est analysé sur votre appareil. Le nom du
  personnage qu'il contient n'est jamais envoyé où que ce soit, et n'est jamais utilisé comme nom
  de palette prédéfinie, nom d'auteur, ou toute autre chose visible par d'autres joueurs. Soumettre
  un mirage aux palettes prédéfinies communautaires exige que vous saisissiez vous-même un nom —
  le champ commence vide exprès, car le nom du personnage et le nom du fichier sont tous deux des
  endroits où les joueurs mettent leur vrai nom.
- **Une exception, qui reste sur votre appareil.** Si vous enregistrez un mirage ou sa palette
  dans ce navigateur sans saisir de nom, l'enregistrement se rabat sur le surnom du personnage,
  puis sur le nom du fichier `.chara`. Ce nom vit dans le stockage de votre navigateur, à côté de
  vos autres collections enregistrées. Il n'est jamais téléversé, et le chemin communautaire
  ci-dessus ne le lit jamais. Renommez ou supprimez l'enregistrement, ou effacez les données de
  votre site, et il disparaît.
- Pour nommer l'équipement sur le bloc de mirage, l'application interroge notre API pour connaître
  l'objet derrière chaque emplacement. La requête ne transporte que les **numéros de modèle** de
  l'équipement provenant du fichier (une douzaine de petits entiers par fichier) — ni le fichier,
  ni le nom, ni les couleurs — et les icônes des objets reviennent depuis le même hôte
  (`data.xivdyetools.app`).

## Ce qui est stocké sur votre appareil

`localStorage` conserve des préférences légères et votre propre travail enregistré : thème, langue,
réglages par outil (y compris le commutateur d'analyses ci-dessous), teintures favorites, palettes
et collections enregistrées, et — si vous vous connectez — le jeton de session de vos palettes
prédéfinies communautaires. Rien ici n'est un identifiant de suivi. « Réinitialiser les paramètres »
dans les Paramètres avancés et les contrôles de données de site de votre navigateur l'effacent.

`IndexedDB` conserve une seule chose : un cache des prix du tableau des ventes déjà récupérés, afin
de ne pas répéter la même recherche. Il ne contient aucune image — une version antérieure de
l'application y conservait votre dernière image d'extracteur, et cette copie est supprimée la
première fois que vous ouvrez l'application après cette mise à jour. Les contrôles de données de
site de votre navigateur l'effacent.

## Accès réseau

L'application ne communique qu'avec ces hôtes de première partie (la Content-Security-Policy du site
n'autorise rien d'autre) ainsi qu'avec les tiers nommés ci-dessous :

1. **Prix du tableau des ventes** (facultatif — le commutateur « Afficher les prix ») : les
   identifiants d'objet et le Monde ou le centre de données que vous avez choisis sont envoyés à
   notre proxy sur `data.xivdyetools.app`, qui les récupère depuis [Universalis](https://universalis.app).
2. **Noms et icônes d'équipement pour les imports `.chara`** — `data.xivdyetools.app` (voir
   ci-dessus).
3. **Palettes prédéfinies communautaires** (`api.xivdyetools.app`) : la navigation n'envoie rien
   vous concernant. Se connecter via `auth.xivdyetools.app` avec Discord ou XIVAuth crée
   immédiatement un enregistrement de compte — votre identifiant de fournisseur et votre nom
   d'utilisateur — que vous alliez ou non ensuite soumettre ou voter. Les palettes prédéfinies et
   les votes que vous soumettez sont stockés sous ce compte, et le nom d'auteur est affiché sur les
   palettes prédéfinies publiées. Lorsque vous soumettez ou modifiez une palette prédéfinie, son
   nom et sa description peuvent aussi être envoyés à la [Perspective API](https://perspectiveapi.com/)
   de Google pour un score de modération (facultatif — modération de contenu uniquement) ; la
   requête indique à Google de ne pas les stocker (`doNotStore`), et rien d'autre — aucune identité
   de compte — n'y est envoyé. Pour faire supprimer votre enregistrement de compte et vos
   soumissions, consultez la section Des questions ? ci-dessous. Les images d'aperçu des palettes
   prédéfinies sont servies depuis `shots.xivdyetools.app` ; les avatars se chargent depuis le CDN
   de Discord.
4. **Liens de partage** : un lien de partage encode dans son URL les teintures ou les couleurs que
   vous avez choisies. Ouvrir un tel lien charge cette URL comme n'importe quelle page ; les
   aperçus de lien sur Discord et ailleurs sont générés par notre propre `og-worker`, qui ne voit
   que l'URL.
5. **Analyses d'utilisation** (avec consentement — voir la section suivante) : `data.xivdyetools.app`.

Les polices sont hébergées par nous-mêmes. Il n'y a aucun script d'analyse tiers, aucun traqueur
publicitaire ou social, et aucun cookie.

### Liens qui vous emmènent vers d'autres sites

Séparément de la liste ci-dessus, certains boutons vous font **naviguer** vers une base de données
communautaire plutôt que de récupérer quoi que ce soit en arrière-plan. Le menu « Ouvrir dans… » du
Nuancier sur une pièce de mirage ouvre [Mirapri](https://mirapri.com/),
[Garland Tools](https://www.garlandtools.org/), [Teamcraft](https://ffxivteamcraft.com/),
[Gamer Escape](https://ffxiv.gamerescape.com/) ou le Lodestone ; une fiche de résultat de teinture
peut ouvrir Universalis, Garland Tools, Teamcraft ou [Saddlebag Exchange](https://saddlebagexchange.com/).

Ce qui circule dans ces liens est l'objet du jeu lui-même — son identifiant d'objet numérique, ou le
nom de l'objet dans la langue utilisée par ce site. Rien vous concernant, ni votre palette, ni votre
personnage, ni votre session, ne se trouve dans l'URL. Ils s'ouvrent dans un nouvel onglet avec le
référent supprimé, de sorte que le site sur lequel vous arrivez n'est pas informé de la page d'où
vous venez. Une fois là-bas, vous êtes sur le site de quelqu'un d'autre, soumis à sa propre
politique de confidentialité.

## Analyses d'utilisation (avec consentement)

Les analyses sont **désactivées par défaut**. Elles ne fonctionnent que lorsque **Paramètres
avancés → Activer les analyses** est activé, et jamais si votre navigateur envoie le signal
[Global Privacy Control](https://globalprivacycontrol.org/) — même avec le commutateur activé. Le
serveur applique aussi cette règle : il n'accepte la télémétrie que depuis les origines propres de
l'application, et rejette tout lot qui porte le signal `Sec-GPC` de votre navigateur avant de
l'écrire. Désactiver le commutateur arrête l'envoi immédiatement, dans tous les onglets ouverts, et
rejette tout ce qui n'a pas encore été envoyé.

Lorsqu'elles sont activées, l'application envoie de petits lots de ces événements à notre API
(`data.xivdyetools.app`), qui les stocke dans Cloudflare Analytics Engine :

- **Vues d'outil** — quel outil a été ouvert, s'il s'agissait de l'outil dans lequel la page s'est
  chargée, d'un lien de partage, ou d'un changement délibéré, et combien de secondes l'onglet est
  resté visible dessus.
- **Choix de teinture** — l'identifiant numérique d'une teinture que vous avez explicitement
  choisie dans le tiroir de palette ou une grille de teintures, et dans quel outil vous vous
  trouviez. Les boutons de teinture aléatoire et les choix que l'outil n'a pas acceptés ne sont pas
  comptés ; votre palette dans son ensemble n'est jamais envoyée.
- **Imports de fichier de personnage** — si un fichier `.chara` a pu être analysé, et quelle
  famille de programme l'a produit (Anamnesis, Ktisis, Brio, autre). Jamais le fichier ni le
  personnage.
- **Changements de thème** — le thème vers lequel vous avez délibérément basculé.

Chaque lot transporte aussi cinq dimensions générales : la version de l'application,
l'environnement (production ou bêta), la langue de l'interface, le thème actuel, et une catégorie
de fenêtre d'affichage (téléphone / tablette / ordinateur).

Ce qui n'est **jamais stocké avec vos événements** : votre adresse IP, votre agent utilisateur ou
les détails de votre appareil, tout compte, session ou identifiant client, les cookies, les URL de
page, les couleurs ou images avec lesquelles vous travaillez, le texte de recherche, le texte des
palettes prédéfinies, les noms de personnage ou de Monde, ou tout ce qui permettrait de relier deux
visites. Le serveur rejette tout ce qui concerne la requête, à l'exception des événements validés,
et la liste des événements est une liste blanche — tout le reste est abandonné. (Votre IP atteint
notre serveur de la même façon qu'elle atteint chaque site que vous visitez ; ce qui lui arrive
ensuite fait l'objet de la section suivante.)

Analytics Engine conserve les données pendant environ trois mois. Le code est open source :
[`apps/web-app/src/services/telemetry-service.ts`](src/services/telemetry-service.ts) (ce que le
navigateur envoie) et
[`apps/api-worker/src/telemetry/schema.ts`](../api-worker/src/telemetry/schema.ts) (ce que le
serveur accepte).

## Votre adresse IP, et ce que les serveurs journalisent

Chaque site que vous visitez reçoit votre adresse IP — c'est ainsi que la réponse vous trouve. La
nôtre est gérée par Cloudflare, et voici l'intégralité de ce que nous en faisons.

- **Prévention des abus.** Notre API compte les requêtes par IP sur une fenêtre de 60 secondes afin
  qu'une seule source ne puisse pas submerger le service. Le comptage est effectué par le propre
  service de limitation de débit de Cloudflare, à qui nous transmettons l'adresse sans la stocker
  nous-mêmes. Il existe un chemin de secours, utilisé uniquement sur un déploiement où ce service
  n'est pas branché, qui conserve à la place un compteur dans Cloudflare KV sous une clé contenant
  l'adresse, pendant **120 secondes**. Aucun des deux chemins n'écrit votre adresse dans une base de
  données, et aucun n'est relié à vos événements d'analyse.
- **Votre IP n'est jamais stockée aux côtés de quoi que ce soit que vous avez fait** — ni vos
  événements, ni vos palettes prédéfinies, ni vos votes. Elle n'est pas utilisée pour relier des
  visites, construire un profil, ou vous identifier.
- **Journaux opérationnels.** Nos workers peuvent afficher de courtes lignes de diagnostic pendant
  le traitement d'une requête. La collecte persistante de journaux (Cloudflare Workers Logs) est
  désactivée sur chacun de nos workers, de sorte que ces lignes ne sont visibles que par un
  mainteneur observant un flux en direct pendant le débogage, et ne sont pas conservées ensuite. Si
  nous activons un jour la journalisation persistante, nous le préciserons ici en premier. Les
  journaux du bot Discord relèvent de [sa propre politique](../discord-worker/PRIVACY_POLICY.md).

## Comment vérifier

1. Ouvrez les outils de développement → Réseau, activez « Conserver le journal ».
2. Utilisez n'importe quel outil avec une image ou un fichier `.chara`.
3. Vous ne verrez aucun téléversement d'image — seulement les requêtes listées ci-dessus, et des
   signaux `/v1/telemetry` uniquement si vous avez activé les analyses.

## Des questions ?

Ouvrez un ticket sur [GitHub](https://github.com/FlashGalatine/xivdyetools/issues) ou demandez sur
Discord. Nous sommes heureux de documenter des garanties supplémentaires si cela aide la communauté
à se sentir en sécurité en utilisant les outils.

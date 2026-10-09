# XIV Dye Tools — Guide de confidentialité (application web)

> Ceci est une traduction fournie à titre pratique. La version anglaise fait foi ; en cas de divergence, c'est elle qui prévaut. [Anglais](PRIVACY.md)

**Dernière mise à jour :** 2026-10-05 · Couvre **xivdyetools.app** et **beta.xivdyetools.app**. Le bot
Discord a sa propre politique : [`apps/discord-worker/PRIVACY_POLICY.md`](../discord-worker/PRIVACY_POLICY.md).

XIV Dye Tools fonctionne dans votre navigateur. Les outils de couleur — l'Extracteur de palette,
l'Explorateur d'harmonies, la Comparaison de Teintures, le Constructeur de Dégradé, le
Mélangeur de Teintures, la Vérification d'accessibilité, les Suggestions Budget, le Nuancier et le
Lecteur de mirages —
effectuent leur travail sur votre appareil. Rien de ce que vous importez, choisissez ou saisissez
n'est envoyé où que ce soit, sauf si une section ci-dessous le précise, et les sections ci-dessous
en forment la liste complète.

## Images et captures d'appareil photo

- Dans les outils de couleur, les images importées, collées, glissées-déposées et capturées par
  l'appareil photo ne quittent jamais votre appareil, et ne sont jamais écrites dans le stockage du
  navigateur. Elles sont lues avec l'API Canvas du navigateur, conservées dans la mémoire de la page
  pour cette session uniquement, et supprimées lorsque vous effacez l'image, fermez l'onglet ou
  rechargez la page.
- L'Extracteur de palette affiche la même chose à l'endroit où vous choisissez un fichier —
  « Les images sont lues dans votre navigateur et jamais envoyées », à côté d'un cadenas. Cet avis
  est un texte simple, pas un lien ; ce document est accessible depuis **À propos → Confidentialité**.
- **Une exception, et seulement si vous le choisissez.** Lorsque vous soumettez ou modifiez une
  palette prédéfinie communautaire, vous pouvez y joindre une **image d'aperçu** facultative. Cette
  image est envoyée à `api.xivdyetools.app`, convertie en WebP, stockée avec la palette prédéfinie,
  et affichée publiquement depuis `shots.xivdyetools.app` une fois qu'un modérateur l'a approuvée.
  L'élément 3 de la section Accès réseau ci-dessous explique comment la supprimer.

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
- Pour nommer l'équipement dans le Lecteur de mirages, l'application interroge notre API pour
  connaître l'objet derrière chaque emplacement. La requête ne transporte que les **numéros de
  modèle** de l'équipement provenant du fichier et l'identifiant de son accessoire de visage (une
  douzaine de petits entiers par fichier) — ni le fichier, ni le nom, ni les couleurs, ni les
  teintures. Notre API recherche ces numéros dans [XIVAPI](https://xivapi.com/), un service
  communautaire de données du jeu, qui reçoit ces numéros et rien vous concernant. Les noms des
  objets, la façon d'obtenir chaque objet et les icônes des objets reviennent depuis le même hôte
  (`data.xivdyetools.app`).

## Ce qui est stocké sur votre appareil

`localStorage` conserve des préférences légères et votre propre travail enregistré : thème, langue,
réglages par outil (y compris le commutateur d'analyses ci-dessous), teintures favorites, palettes
et collections enregistrées, les lignes d'obtention que vous avez réécrites dans la « Liste
d'équipement » du Lecteur de mirages, et — si vous vous connectez — le jeton de session de vos
palettes prédéfinies communautaires. Rien ici n'est un identifiant de suivi. Les contrôles de
données de site de votre navigateur effacent tout cela. Dans l'application, chacune de ces actions
en efface une partie :

- **Paramètres avancés → Réinitialiser les paramètres** remet les réglages de chaque outil à leurs
  valeurs par défaut. Cela ne supprime pas votre travail enregistré.
- **Paramètres avancés → Effacer les favoris** supprime vos teintures favorites.
- **Paramètres avancés → Effacer les palettes sauvegardées** supprime vos palettes enregistrées.
- **Gérer les collections → Supprimer la collection** supprime une collection enregistrée.
- Se déconnecter supprime le jeton de session.
- « Tout réinitialiser » dans la Liste d'équipement supprime les lignes réécrites de cette tenue.

`IndexedDB` conserve une seule chose : un cache des prix du tableau des ventes déjà récupérés, afin
de ne pas répéter la même recherche. Il ne contient aucune image — une version antérieure de
l'application y conservait votre dernière image d'extracteur, et cette copie est supprimée la
première fois que vous ouvrez l'application après cette mise à jour. Les contrôles de données de
site de votre navigateur l'effacent.

## Accès réseau

L'application ne communique qu'avec ces hôtes de première partie (la Content-Security-Policy du site
n'autorise rien d'autre) ainsi qu'avec les tiers nommés ci-dessous :

1. **Prix du tableau des ventes** (facultatif — le commutateur « Activer le tableau des ventes »
   dans la colonne des réglages ; « Suggestions Budget » les charge toujours, car cet outil compare
   les teintures selon leur prix) : les identifiants d'objet et le Monde ou le centre de données que
   vous avez choisis sont envoyés à notre proxy sur `data.xivdyetools.app`, qui les récupère depuis
   [Universalis](https://universalis.app).
2. **Noms et icônes d'équipement pour les imports `.chara`** — `data.xivdyetools.app` (voir
   ci-dessus).
3. **Palettes prédéfinies communautaires** (`api.xivdyetools.app`) : la navigation n'envoie rien
   vous concernant. Se connecter via `auth.xivdyetools.app` avec Discord ou XIVAuth crée
   immédiatement un enregistrement de compte, que vous alliez ou non ensuite soumettre ou voter.
   Avec Discord, l'enregistrement contient votre identifiant utilisateur Discord et votre nom
   d'affichage (votre nom d'utilisateur si vous n'avez pas de nom d'affichage). Avec XIVAuth,
   l'enregistrement contient votre identifiant XIVAuth et le nom de votre personnage vérifié. Si
   aucun n'est disponible lors de votre connexion, le nom est « XIVAuth User » suivi
   des 8 premiers caractères de votre identifiant XIVAuth.
   Si votre compte XIVAuth est lié à Discord, l'enregistrement
   contient aussi cet identifiant utilisateur Discord. Le nom figurant dans l'enregistrement est
   affiché comme auteur de chaque palette prédéfinie que vous publiez, et il est mis à jour sur
   chacune d'elles à chaque fois que vous vous connectez (pas tant qu'un bannissement est actif). Si
   vous liez ensuite Discord à votre compte XIVAuth, vos palettes prédéfinies, vos votes et vos
   compteurs de limite quotidienne passent à cet identifiant utilisateur Discord à votre prochaine
   connexion (là encore, pas tant qu'un bannissement est actif). Les palettes prédéfinies et les
   votes que vous soumettez sont stockés sous ce compte. Soumettre une palette prédéfinie compte
   comme votre vote pour elle ; si une palette prédéfinie publiée a déjà les mêmes teintures, votre
   soumission devient un vote pour cette palette à la place. Une palette prédéfinie contient ce que
   vous saisissez dans le formulaire — et, si notre vérification automatique retient pour examen le
   nouveau nom ou la nouvelle description d'une modification, la version antérieure à la première
   modification de ce type, conservée jusqu'à ce qu'un modérateur la restaure ou que la palette
   prédéfinie soit supprimée — plus l'image d'aperçu facultative décrite sous Images ci-dessus. Pour
   supprimer une image d'aperçu, utilisez le formulaire de modification de la palette prédéfinie ;
   supprimer une palette prédéfinie depuis **Mes soumissions** supprime aussi son image d'aperçu.
   Lorsque vous soumettez ou modifiez une palette prédéfinie, son nom et sa description peuvent
   aussi être envoyés à la [Perspective API](https://perspectiveapi.com/) de Google pour un score de
   modération (facultatif — modération de contenu uniquement) ; la requête indique à Google de ne
   pas les stocker (`doNotStore`), et rien d'autre — aucune identité de compte — n'y est envoyé. Ce
   que nous conservons d'autre sur vos palettes prédéfinies, et pour combien de temps, figure sous
   *Palettes prédéfinies communautaires : ce que nous conservons* ci-dessous ; la façon de le
   supprimer figure sous *Supprimer vos données*. Les images d'aperçu des palettes prédéfinies sont
   servies depuis `shots.xivdyetools.app` ; les avatars se chargent depuis le CDN de Discord.
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
Lecteur de mirages sur une pièce de mirage ouvre [Mirapri](https://mirapri.com/),
[Garland Tools](https://www.garlandtools.org/), [Teamcraft](https://ffxivteamcraft.com/),
[Gamer Escape](https://ffxiv.gamerescape.com/) ou le Lodestone ; une fiche de résultat de teinture
peut ouvrir Universalis, Garland Tools, Teamcraft ou [Saddlebag Exchange](https://saddlebagexchange.com/).

Ce qui circule dans ces liens est l'objet du jeu lui-même — son identifiant d'objet numérique, ou le
nom de l'objet dans la langue utilisée par ce site. Rien vous concernant, ni votre palette, ni votre
personnage, ni votre session, ne se trouve dans l'URL. Ils s'ouvrent dans un nouvel onglet avec le
référent supprimé, de sorte que le site sur lequel vous arrivez n'est pas informé de la page d'où
vous venez. Une fois là-bas, vous êtes sur le site de quelqu'un d'autre, soumis à sa propre
politique de confidentialité.

Une palette prédéfinie communautaire peut aussi porter un **lien d'exemple**, choisi par son auteur.
Il pointe vers une page de l'un de ces sites : Eorzea Collection, Mirapri, Reddit, X, Bluesky,
Instagram, pixiv, Misskey, ou le site officiel de Final Fantasy XIV, qui inclut le Lodestone.
L'application n'affiche aucun lien d'exemple vers un autre site. Le lien est celui de l'auteur, et
il ne transporte rien vous concernant. Il s'ouvre de la même façon : dans un nouvel onglet, avec le
référent supprimé.

## Palettes prédéfinies communautaires : ce que nous conservons

Cette section ne s'applique que si vous vous connectez aux palettes prédéfinies communautaires.
Tout ce qui suit est stocké sur Cloudflare — l'enregistrement de compte par notre service de
connexion (`auth.xivdyetools.app`), le reste par notre service de palettes prédéfinies
(`api.xivdyetools.app`) — à l'exception des messages publiés sur notre serveur Discord.

- **Votre enregistrement de compte, vos palettes prédéfinies et vos votes** (élément 3 ci-dessus)
  sont conservés jusqu'à ce que vous les supprimiez ou nous demandiez de les supprimer (voir
  *Supprimer vos données*).
- **Limites quotidiennes.** Chaque palette prédéfinie que vous soumettez, chaque modification du nom
  ou de la description d'une palette prédéfinie que vous envoyez, et chaque image d'aperçu que vous
  téléversez est comptée afin que les limites quotidiennes puissent être appliquées. Le compteur
  consigne l'identifiant de votre compte, le type d'action, la palette prédéfinie et l'heure, et il
  est supprimé après **30 jours** ; supprimer la palette prédéfinie ne le supprime pas plus tôt.
- **Messages sur notre serveur Discord.** Nos modérateurs travaillent dans deux salons privés de
  notre serveur Discord. Le salon de modération reçoit chaque palette prédéfinie, modification ou
  image d'aperçu qui nécessite une vérification : le message montre la palette prédéfinie (par
  exemple son nom, sa description, sa catégorie et ses teintures) et le nom de l'auteur ou, pour une
  image d'aperçu, le nom de la palette prédéfinie et l'image, et il est mis à jour lorsqu'un
  modérateur tranche. Si un modérateur vous bannit, le salon de modération reçoit aussi un message
  avec votre nom d'auteur, le motif et le nombre de vos palettes prédéfinies qui ont été masquées.
  Les modérateurs peuvent aussi publier dans le salon de modération la liste des palettes
  prédéfinies en attente de vérification, avec le nom de leurs auteurs. Le salon de journal des
  soumissions reçoit chaque palette prédéfinie publiée sans vérification, avec le nom de son auteur,
  et une note nommant la palette prédéfinie lorsqu'un modérateur en approuve ou en rejette une, ou
  en annule une modification, avec le motif d'un rejet ou d'une annulation. Les messages publiés
  depuis la date de *Dernière mise à jour* ci-dessus ne montrent pas votre identifiant utilisateur
  Discord ; les plus anciens peuvent le montrer. Les messages restent dans ces salons, soumis à la
  [politique de confidentialité de Discord](https://discord.com/privacy), jusqu'à ce qu'un
  modérateur les supprime ou jusqu'à ce que vous demandiez la suppression.
- **Notifications en échec.** Si une palette prédéfinie ne peut pas être publiée sur notre serveur
  Discord, nous conservons un enregistrement qui nomme la palette prédéfinie et l'erreur, afin
  qu'un modérateur puisse rattraper le retard. Il ne contient rien sur votre compte. Il est supprimé
  **30 jours** après qu'un modérateur l'a résolu, après **90 jours** si personne ne le fait, et
  immédiatement si la palette prédéfinie est supprimée.
- **Enregistrements de bannissement.** Si un modérateur vous bannit des palettes prédéfinies
  communautaires, l'enregistrement de bannissement contient votre identifiant utilisateur Discord
  ou, si vous vous êtes connecté avec un compte XIVAuth qui n'est pas lié à Discord, l'identifiant
  de compte que notre service de connexion vous a attribué à la place (un identifiant aléatoire, qui
  n'est pas votre identifiant XIVAuth). Il contient aussi le nom d'auteur affiché sur vos palettes
  prédéfinies au moment du bannissement, les identifiants utilisateur Discord du modérateur qui a
  prononcé le bannissement et de celui qui l'a levé, le motif indiqué par le modérateur, ainsi que
  les dates du bannissement et de sa levée. L'enregistrement est conservé tant que le bannissement
  est actif. Lorsque le bannissement est levé, le nom d'auteur et le motif sont effacés
  immédiatement de l'enregistrement de bannissement, et l'enregistrement est supprimé **90 jours**
  plus tard. Les entrées du journal de modération concernant le bannissement conservent le motif,
  comme décrit ensuite.
- **Le journal de modération.** Chaque action de modération est consignée avec l'identifiant
  utilisateur Discord du modérateur, l'action, un motif facultatif et l'heure. Un bannissement,
  une levée de bannissement, un masquage ou une restauration désigne aussi le compte concerné, et
  est supprimé après **12 mois**, ou plus tôt pour un masquage ou une restauration si sa palette
  prédéfinie est supprimée. Toute autre entrée concernant une palette prédéfinie (par exemple
  approuver, rejeter ou annuler une modification) désigne cette palette, et est conservée tant
  que la palette prédéfinie existe.

Le bot Discord conserve les mêmes enregistrements pour les palettes prédéfinies soumises par son
intermédiaire ; voir [sa politique](../discord-worker/PRIVACY_POLICY.md).

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
   signaux `/v1/telemetry` uniquement si vous avez activé les analyses. Le seul téléversement
   d'image que l'application effectue jamais est une image d'aperçu de palette prédéfinie que vous
   joignez vous-même (voir Images ci-dessus).

## Supprimer vos données

Vous pouvez en supprimer une partie vous-même, à tout moment, sauf si un modérateur vous a banni des
palettes prédéfinies communautaires (tant qu'un bannissement est actif, adressez-vous plutôt à
nous) :

- **Une palette prédéfinie :** supprimez-la depuis **Mes soumissions**. Son image d'aperçu, les
  votes qui la concernent, les entrées du journal de modération à son sujet et tout enregistrement
  de notification en échec qui la concerne sont supprimés avec elle. Ses compteurs de limite
  quotidienne expirent d'eux-mêmes après 30 jours, et les messages à son sujet sur notre serveur
  Discord restent, sauf si vous nous le demandez (ci-dessous).
- **Un vote :** sélectionnez de nouveau le bouton de vote (**Voter** / **Voté**) de cette palette
  prédéfinie.
- **Votre session :** vous déconnecter (**Déconnexion**) supprime le jeton de session de ce
  navigateur et demande à notre service de connexion de le révoquer.

Pour tout le reste — votre enregistrement de compte, ou tout ce qui se trouve sous votre compte en
une seule fois — demandez-nous en privé :

1. **E-mail :** FlashGalatineFGC@gmail.com, avec l'objet « XIV Dye Tools Privacy ».
2. **Discord :** rejoignez https://discord.gg/rzxDHNr6Wv et envoyez un message privé à « Flash
   Galatine ».

Précisez si vous vous connectez avec Discord ou avec XIVAuth, et indiquez votre identifiant
utilisateur Discord ou le nom d'auteur affiché sur vos palettes prédéfinies. Merci de ne pas faire
cette demande dans un ticket GitHub public : cela publierait justement les informations que vous voulez
faire supprimer.

Nous traitons les demandes de suppression sous **30 jours**. Une demande supprime aussi de notre
serveur Discord les messages vous concernant et concernant vos palettes prédéfinies, à l'exception
du message sur un bannissement toujours actif. Un enregistrement de bannissement actif n'est pas
supprimé sur demande ; une fois le bannissement levé, il suit la durée de conservation indiquée
sous *Palettes prédéfinies communautaires : ce que nous conservons*.

## Des questions ?

Ouvrez un ticket sur [GitHub](https://github.com/FlashGalatine/xivdyetools/issues) ou demandez sur
Discord. Pour une demande de suppression, utilisez plutôt les voies privées décrites sous
*Supprimer vos données*. Nous sommes heureux de documenter des garanties supplémentaires si cela
aide la communauté à se sentir en sécurité en utilisant les outils.

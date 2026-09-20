# XIV Dye Tools Discord Bot - Politique de confidentialité

> Ceci est une traduction fournie à titre pratique. La version anglaise fait foi ; en cas de divergence, c'est elle qui prévaut. [Anglais](PRIVACY_POLICY.md)

**Dernière mise à jour** : 2026-09-16

## 1. Introduction

Cette politique de confidentialité explique comment XIV Dye Tools Discord Bot (« le Bot », « nous », « notre ») collecte, utilise et protège vos informations lorsque vous utilisez nos services.

Nous nous engageons à protéger votre vie privée et à être transparents sur nos pratiques en matière de données. Ce Bot est un outil communautaire créé par des fans et n'est pas affilié à Square Enix.

## 2. Données que nous collectons

### Informations collectées automatiquement

| Type de donnée | Finalité | Conservation |
|-----------|---------|-----------|
| Identifiant utilisateur Discord | Identifier les utilisateurs pour les préférences, les palettes prédéfinies favorites, le vote, la limitation de débit, et le repère de premier lancement ; sert aussi de clé à un repère d'activité quotidien par utilisateur et est compté (jamais listé) dans les statistiques d'utilisation — voir *Statistiques d'utilisation* ci-dessous | Jusqu'à la demande de suppression des données (statistiques d'utilisation : voir *Statistiques d'utilisation*) |
| Nom d'utilisateur Discord | Attribuer les soumissions de palettes prédéfinies communautaires | Jusqu'à la demande de suppression des données |
| Langue de l'utilisateur | Fournir des réponses du bot localisées ; la langue du client Discord (répartie dans l'une des six que le Bot prend en charge, ou « autre ») est aussi enregistrée dans les statistiques d'utilisation — voir *Statistiques d'utilisation* ci-dessous | Préférence stockée : jusqu'à effacement. Répartition des statistiques d'utilisation : voir *Statistiques d'utilisation* |
| ID de serveur / ID de salon | Traiter les commandes dans leur contexte | Non stocké. Les statistiques d'utilisation n'enregistrent que le *fait* qu'une commande ait été exécutée sur un serveur ou en message privé (les valeurs `guild` / `dm`) — jamais l'ID du serveur ou du salon |

### Informations que vous fournissez

| Type de donnée | Finalité | Conservation |
|-----------|---------|-----------|
| Préférences | Langue, mode de mélange, méthode de correspondance, nombre de résultats, clan, genre, Monde / centre de données par défaut, si les prix du tableau des ventes doivent être affichés par défaut, bascules d'affichage des couleurs, thème, et quelles catégories de teintures exclure des résultats de recherche (métallique, pastel, sombre, cosmique, ishgardienne, chère, de vendeur, artisanale) | Jusqu'à réinitialisation ou demande de suppression |
| Palettes prédéfinies favorites | Jusqu'à 50 palettes prédéfinies communautaires que vous marquez avec `/preset favorite add` — l'id de la palette prédéfinie et le nom qu'elle portait quand vous l'avez enregistrée | Jusqu'à leur retrait ou demande de suppression |
| Repère de premier lancement | Un repère par utilisateur indiquant que l'avis de bienvenue 5.0 vous a été montré ; ne porte aucun contenu | Expire automatiquement après 180 jours |
| Soumissions de palettes prédéfinies | Nom, description, teintures, étiquettes, catégorie | Indéfiniment (contenu communautaire) |
| Votes | Vos votes sur les palettes prédéfinies communautaires | Jusqu'à leur retrait ou demande de suppression |

### Données de limitation de débit

- Les compteurs par utilisateur et par commande sont conservés par le service de limitation de débit des Workers de Cloudflare pendant la fenêtre de 60 secondes et ne sont jamais écrits dans KV.
- **Repli** : sur un déploiement sans les liaisons natives de limitation de débit, les compteurs sont conservés dans Cloudflare KV à la place, sous une clé contenant votre identifiant utilisateur Discord et le nom de la commande, avec une expiration de 120 secondes. La production et la bêta lient toutes deux le service natif, ce chemin n'y est donc pas utilisé.
- Le Bot ne voit ni n'utilise jamais votre adresse IP pour la limitation de débit — il vous identifie par votre identifiant utilisateur Discord, car les commandes arrivent depuis les serveurs de Discord plutôt que directement de vous.
- Aucun tiers n'est impliqué.

### Statistiques d'utilisation

Pour maintenir le Bot en bonne santé et pour alimenter le tableau de bord `/stats`, nous enregistrons, pour chaque commande que vous exécutez ou chaque bouton de copie que vous pressez :

| Donnée | Où | Conservation |
|------|-------|-----------|
| Le nom de la commande et de la sous-commande, si elle a reçu une réponse et — en cas de problème — une classe d'échec grossière (limité par débit, requête rejetée par le service de palettes prédéfinies ou de marché, données de marché indisponibles, service de palettes prédéfinies indisponible, l'image ou le fichier `.chara` téléversé n'a pas pu être lu, le rendu a échoué, inconnu ; jamais un message d'erreur), la durée qu'elle a prise, si elle a été exécutée sur un serveur ou en message privé (`guild` / `dm` — jamais l'ID du serveur), la langue de votre client Discord (l'une des six que le Bot prend en charge, ou « autre »), quel bouton de copie vous avez pressé (hex / RGB / HSV), et votre identifiant utilisateur Discord (utilisé uniquement pour compter les utilisateurs uniques) | Cloudflare Workers Analytics Engine | Fenêtre de conservation de l'Analytics Engine de Cloudflare (3 mois au moment de la rédaction) |
| Compteurs agrégés — total des commandes, comptes par commande, succès/échecs (aucune donnée utilisateur) | Cloudflare KV | 30 jours (TTL automatique) |
| Une clé par utilisateur et par jour (`usertrack:{date}:{userId}`, valeur `1`) afin de pouvoir compter les utilisateurs actifs quotidiens | Cloudflare KV | 30 jours (TTL automatique) |

Ces enregistrements n'incluent jamais le contenu des messages, les valeurs des options de commande, les noms de serveur ou les ID de salon. Les données de l'Analytics Engine ne peuvent pas être modifiées ou supprimées par utilisateur une fois écrites ; elles expirent selon le calendrier de Cloudflare.

## 3. Données que nous NE collectons PAS

Nous ne collectons explicitement **pas** :

- ❌ Le contenu des messages (au-delà des paramètres de commande)
- ❌ Les informations personnelles (e-mail, nom réel, numéro de téléphone)
- ❌ Les adresses IP (abstraites par Cloudflare Workers)
- ❌ Les listes des membres du serveur
- ❌ Les messages privés
- ❌ Les données vocales
- ❌ Les images (traitées en mémoire, non stockées)
- ❌ Les noms de personnage issus des fichiers `.chara` (jamais affichés sur les cartes ou les messages intégrés, jamais stockés)

### Traitement des images

Lorsque vous utilisez `/extractor image`, votre image téléversée est :
1. Traitée en mémoire sur les serveurs de périphérie de Cloudflare
2. Analysée pour en extraire les couleurs dominantes
3. **Immédiatement supprimée** après traitement
4. **Jamais stockée** sur nos serveurs

## 4. Comment nous utilisons vos données

| Finalité | Données utilisées |
|---------|-----------|
| Fournir les fonctionnalités du Bot | ID utilisateur, ID de serveur, ID de salon |
| Enregistrer vos préférences | ID utilisateur et les valeurs de préférence que vous avez définies |
| Gérer vos palettes prédéfinies favorites | ID utilisateur, ID de palette prédéfinie |
| Palettes prédéfinies communautaires | ID utilisateur, Nom d'utilisateur, Contenu de la palette prédéfinie |
| Système de vote | ID utilisateur, ID de palette prédéfinie |
| Prévenir les abus | ID utilisateur, Compteurs de limitation de débit |
| Statistiques d'utilisation (`/stats`) | Nom de la commande et de la sous-commande, classe de résultat, latence, indicateur serveur/message privé, répartition de langue du client, type de bouton de copie, ID utilisateur (compté, jamais listé) |

## 5. Stockage des données

### Où vos données sont stockées

| Service | Données stockées | Emplacement |
|---------|-------------|----------|
| Cloudflare KV | Préférences, palettes prédéfinies favorites, le repère de premier lancement, les compteurs d'utilisation et les clés d'activité quotidienne (TTL de 30 jours), et les compteurs de limitation de débit uniquement sur un déploiement sans les liaisons natives de limitation de débit (TTL de 120 secondes) | Réseau de périphérie mondial |
| Cloudflare D1 | Palettes prédéfinies communautaires, Votes, Historique de modération, enregistrements d'échec de notification de modération, compteurs quotidiens de soumission / modification (voir *Conservation des données*) | Infrastructure de base de données de Cloudflare |
| Cloudflare Workers Analytics Engine | Télémétrie d'utilisation des commandes (voir *Statistiques d'utilisation*) | Infrastructure analytique de Cloudflare |

Toutes les données sont stockées sur l'infrastructure de Cloudflare. Voir la [politique de confidentialité de Cloudflare](https://www.cloudflare.com/privacypolicy/) pour plus d'informations.

### Sécurité des données

- Toutes les données sont transmises via HTTPS
- Pas de sessions côté serveur (architecture sans état)
- Accès contrôlé via l'authentification Discord
- Aucun stockage de mot de passe en clair (nous ne collectons pas de mots de passe)

### Journaux opérationnels

Pendant le traitement d'une commande, le Bot peut afficher de courtes lignes de diagnostic. Deux d'entre elles incluent **votre identifiant utilisateur Discord** — l'une quand une commande démarre, l'autre quand une commande est limitée par débit — aux côtés du nom de la commande. Elles n'incluent jamais les valeurs des options de commande, le contenu des messages, les noms de serveur, les ID de salon, ni quoi que ce soit provenant d'une image téléversée ou d'un fichier `.chara`.

La collecte persistante de journaux (Cloudflare Workers Logs) est désactivée pour le Bot, de sorte que ces lignes n'existent que dans un flux de débogage en direct qu'un mainteneur observe à cet instant précis, et ne sont pas conservées ensuite. Elles ne constituent pas un entrepôt de données, ne sont pas interrogeables, et sont distinctes des statistiques d'utilisation décrites ci-dessus. Si nous activons un jour la journalisation persistante, cette politique sera mise à jour en premier.

## 6. Services tiers

Le Bot s'intègre à ces services tiers :

| Service | Finalité | Leur politique de confidentialité |
|---------|---------|---------------------|
| Discord | Plateforme du Bot, authentification | [Politique de confidentialité de Discord](https://discord.com/privacy) |
| Cloudflare | Hébergement, stockage des données (KV, D1), limitation de débit, analytique | [Politique de confidentialité de Cloudflare](https://www.cloudflare.com/privacypolicy/) |
| Universalis | Données du tableau des ventes FFXIV | [Universalis](https://universalis.app/) |
| Perspective API | Modération de contenu (facultatif) | [Politique de confidentialité de Google](https://policies.google.com/privacy) |

Nous ne vendons, n'échangeons, ni ne partageons vos données personnelles avec des tiers à des fins de marketing.

## 7. Vos droits

Vous avez le droit de :

### Accéder à vos données
- Utiliser `/preferences show` pour consulter vos préférences enregistrées
- Utiliser `/preset favorite list` pour consulter vos palettes prédéfinies favorites
- Nous contacter pour demander un export complet de vos données

### Supprimer vos données
- Utiliser `/preferences reset` pour réinitialiser toutes vos préférences, ou `/preferences reset key:<preference>` pour n'en réinitialiser qu'une seule
- Utiliser `/preset favorite remove` pour retirer une palette prédéfinie favorite
- Nous contacter pour demander la suppression complète de vos données

Le repère de premier lancement n'est pas gérable par l'utilisateur — il expire de lui-même après 180 jours.

### Demander la suppression complète des données

Pour demander la suppression de toutes vos données :

1. **E-mail** : FlashGalatineFGC@gmail.com
   - Objet : « XIV Dye Tools Privacy »
   - Indiquez votre identifiant utilisateur Discord
2. **Discord** : Rejoignez https://discord.gg/rzxDHNr6Wv et envoyez un DM à « Flash Galatine »

Nous traiterons les demandes de suppression sous 30 jours.

## 8. Conservation des données

| Type de donnée | Durée de conservation |
|-----------|-----------------|
| Compteurs de limitation de débit | 60 secondes (120 secondes sur un déploiement sans les liaisons natives de limitation de débit) |
| Compteurs d'utilisation (Cloudflare KV) | 30 jours |
| Clés d'activité quotidienne par utilisateur (Cloudflare KV) | 30 jours |
| Télémétrie d'utilisation des commandes (Analytics Engine) | Fenêtre de conservation de l'Analytics Engine de Cloudflare (3 mois au moment de la rédaction) |
| Préférences utilisateur | Jusqu'à suppression par l'utilisateur |
| Palettes prédéfinies favorites | Jusqu'à leur retrait par vous |
| Repère de premier lancement | 180 jours |
| Palettes prédéfinies communautaires | Indéfiniment (contenu public) |
| Votes | Jusqu'à leur retrait ou suppression du compte |
| Enregistrements d'échec de notification de modération (id de la palette prédéfinie, erreur, horodatages) | 30 jours après résolution, 90 jours si non résolu — supprimés immédiatement si la palette prédéfinie est supprimée |
| Compteurs quotidiens de soumission / modification (id utilisateur, type, horodatage) | 30 jours |

## 9. Confidentialité des mineurs

Le Bot est destiné aux utilisateurs qui satisfont à l'exigence d'âge minimum de Discord (13 ans ou plus, ou l'âge minimum de votre pays). Nous ne collectons pas sciemment de données auprès d'enfants en dessous de ces limites d'âge.

Si vous pensez qu'un enfant en dessous de l'âge minimum nous a fourni des données, veuillez nous contacter pour leur suppression.

## 10. Transferts internationaux de données

Vos données peuvent être traitées dans tout pays où Cloudflare exploite des serveurs de périphérie. En utilisant le Bot, vous consentez à ce transfert. Cloudflare maintient des garanties appropriées pour les transferts internationaux de données.

## 11. Modifications de cette politique

Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. Les changements seront :

- Publiés dans ce document avec une date de « Dernière mise à jour » actualisée
- Annoncés sur notre serveur Discord pour les changements importants

Continuer à utiliser le Bot après des changements vaut acceptation de la politique mise à jour.

## 12. Contact

Pour toute question relative à la confidentialité ou toute demande concernant vos données :

- **E-mail** : FlashGalatineFGC@gmail.com (Objet : « XIV Dye Tools Privacy »)
- **Discord** : https://discord.gg/rzxDHNr6Wv
- **Canal d'assistance** : #dyetools-issues-and-suggestions

---

**En utilisant XIV Dye Tools Discord Bot, vous reconnaissez avoir lu et compris cette politique de confidentialité.**

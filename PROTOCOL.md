# Protocole collecteur -> overlay

Le collecteur sert le WebSocket `ws://localhost:9001/api`. Deux formes de
message, et c'est tout. Le collecteur ne sait rien de ta scene : tu es
libre de l'ecrire avec ce que tu veux, du moment que tu lis ce contrat.

## 1. L'etat complet

```json
{ "kind": "state", "state": { ... } }
```

Envoye a chaque changement, **et une fois a la connexion**. Il est
idempotent : il decrit entierement l'ecran a peindre, sans reference a ce
qui precede. C'est volontaire — la Browser Source d'OBS se reconnecte
souvent en pleine draft, et ton overlay doit pouvoir repartir de zero
sans rien avoir manque.

Regle a suivre : **le rendu ne depend que de `state`**. Si tu accumules
quoi que ce soit a cote (un tableau de picks que tu remplis au fil des
evenements), une reconnexion te laissera avec un ecran faux.

### Forme de `state`

```json
{
  "active": true,
  "phase": "BAN_PICK",
  "timer": { "msLeft": 18400, "msTotal": 27000, "receivedAt": 1793712660785 },
  "current": { "actionId": 3, "type": "pick", "team": "red", "cellId": 5, "slotIndex": 0 },
  "teams": {
    "blue": { "picks": [ /* PickSlot */ ], "bans": [ /* BanSlot */ ] },
    "red":  { "picks": [ /* PickSlot */ ], "bans": [ /* BanSlot */ ] }
  }
}
```

| champ | sens |
| --- | --- |
| `active` | `false` hors draft. Ton overlay doit afficher du vide, pas un etat fige. |
| `phase` | chaine du client telle quelle (`PLANNING`, `BAN_PICK`, `FINALIZATION`). Informative : ne construis pas de logique dessus, Riot la change sans prevenir. |
| `current` | qui joue maintenant, ou `null`. `slotIndex` est la position dans son equipe, 0 a 4. |

#### `timer`

`msLeft` est une **photo a l'instant du message**, pas un decompte. Le
collecteur ne tick pas : il relaie ce que le client lui donne. Pour une
horloge fluide, fais tourner ton propre decompte et resynchronise a
chaque message :

```js
const ecoule  = Date.now() - state.timer.receivedAt;
const restant = Math.max(0, state.timer.msLeft - ecoule);
```

`msTotal` est la duree de la phase courante. Utilise-la pour une barre de
progression : la duree varie (environ 27 s pour un ban, 30 s pour un
pick, et une custom peut etre configuree autrement). Elle vaut `0` si le
client ne la donne pas — prevois ce cas plutot que de diviser par zero.

#### `PickSlot`

```json
{
  "cellId": 5, "slotIndex": 0, "position": "", "playerName": null,
  "championId": 1, "hovering": true, "locked": false,
  "championName": "Annie",
  "iconUrl": ".../champion-icons/1.png",
  "splashUrl": ".../champion-splashes/1/1000.jpg",
  "artUrl": ".../img/champion/loading/Annie_0.jpg",
  "artFallbackUrl": ".../champion-splashes/1/1000.jpg"
}
```

- `cellId` est l'identifiant stable du siege (0-4 bleu, 5-9 rouge).
  **Utilise-le comme cle de rendu**, pas l'index du tableau : le nombre
  de slots peut varier d'un message a l'autre.
- `slotIndex` = `cellId % 5`, la position dans l'equipe.
- Trois etats mutuellement exclusifs : `locked` (valide), `hovering`
  (survol en cours, non valide), et ni l'un ni l'autre (vide).
  `championId` vaut `0` quand le slot est vide, et tous les champs
  d'image sont alors `null`.
- `artUrl` est l'artwork de l'ecran de chargement, cadre portrait
  308x560 — le seul asset officiel deja taille pour une colonne
  verticale. Il peut rendre 404 sur quelques champions dont la cle
  differe entre Data Dragon et CommunityDragon : branche
  `artFallbackUrl` sur l'erreur de chargement.
  ```jsx
  <img src={slot.artUrl} onError={(e) => { e.currentTarget.src = slot.artFallbackUrl }} />
  ```
- `position` et `playerName` sont souvent vides : le client ne les donne
  pas forcement en spectate. Prevois une saisie manuelle a cote.

#### `BanSlot`

```json
{ "index": 0, "championId": 266, "championName": "Aatrox",
  "iconUrl": ".../champion-icons/266.png", "locked": true }
```

Seuls les bans **verrouilles** apparaissent, dans l'ordre chronologique.
Un ban en cours de survol est volontairement absent : le relayer
reviendrait a spoiler le ban a l'antenne avant qu'il soit valide.
`locked` est donc toujours `true` — le champ reste pour ne pas casser le
contrat si on change d'avis.

## 2. Les evenements

```json
{ "kind": "events", "events": [ { "type": "pick.locked", ... } ] }
```

Ils ne decrivent pas l'ecran, ils **declenchent des animations**. L'etat
complet te dit qu'un pick est verrouille ; l'evenement te dit qu'il vient
de l'etre. Un overlay sans animation peut les ignorer entierement.

| type | charge |
| --- | --- |
| `draft.started` | — |
| `draft.ended` | — |
| `turn.changed` | `actor: { team, slotIndex }`, `action: 'ban' \| 'pick'` |
| `pick.hovered` | `team`, `slotIndex`, `championId`, `championName` |
| `pick.locked` | `team`, `slotIndex`, `championId`, `championName` |
| `ban.locked` | `team`, `index`, `championId`, `championName` |

Deux garanties utiles :

- **Pas de rafale a la reconnexion.** Quand le collecteur arrive en
  pleine draft, il emet `draft.started` et rien d'autre, meme si six bans
  et quatre picks sont deja acquis. Sans ca tu aurais dix animations
  simultanees a chaque redemarrage.
- `pick.hovered` n'est emis que sur **changement** de champion, pas a
  chaque message recu.

Les evenements arrivent toujours **apres** le `state` correspondant dans
le meme cycle : quand tu recois `pick.locked`, le nouvel etat est deja
applique.

## Contraintes de la scene

- Canvas fixe **1920x1080**, pas de responsive. OBS rend a taille fixe.
- **N'anime que `transform` et `opacity`.** Le Chromium embarque d'OBS
  n'a pas d'acceleration sur le reste : animer `width`, `top` ou
  `box-shadow` fait tomber le framerate en plein cast.
- Un trou reellement transparent (pas une couleur de fond) la ou doit
  apparaitre une source video placee SOUS la Browser Source dans OBS.

## Developper sans client League

```
npm run replay -- recordings/draft-XXXX.ndjson --speed 3
```

Le rejeu sert le meme WebSocket sur le meme port : ton overlay ne voit
aucune difference avec le direct. C'est la bonne facon de travailler une
animation, en bouclant une vraie draft.

## Diagnostiquer le client

```
npm run probe
```

Interroge le client en direct et dit ce qu'il expose : quels endpoints
repondent, combien de `cellId` sont visibles, si les deux equipes sont
la, si les hovers adverses fuitent. A lancer pendant une draft.

# draft-collector

Collecteur de champ select League of Legends pour overlay OBS.

## Demarrage

    npm install
    npm run dev

Puis dans OBS, Browser Source sur `http://localhost:9001`, 1920x1080.
Decoche "Eteindre la source quand elle n'est pas visible" et
"Rafraichir le navigateur quand la scene devient active".

## Enregistrer une draft, puis la rejouer

    npm run record                                  # pendant une vraie custom
    npm run replay -- recordings/draft-XXXX.ndjson --speed 3

Le rejeu sert exactement le meme WebSocket : ton overlay ne voit pas la
difference, et tu developpes sans lancer de partie.

## Protocole cote overlay

    { "kind": "state",  "state":  { ... } }   // etat complet, idempotent
    { "kind": "events", "events": [ ... ] }   // declencheurs d'animation

## Variables d'environnement

    PORT=9001
    LEAGUE_LOCKFILE=D:\Riot Games\League of Legends\lockfile
    RECORD=1

## Overlay (Vite + React)

    cd overlay && npm install && npm run dev

- `http://localhost:5173/?dev&scale=0.5` — panneau d'etats + apercu reduit
- `http://localhost:5173/?dev&offline` — sans collecteur, etats a la main
- `npm run build` compile dans `../public`, servi par le collecteur sur :9001

La page de debug d'origine reste disponible : `PUBLIC_DIR=debug npm run dev`
depuis la racine.

### Fenetre camera

La bande centrale reserve un rectangle transparent pour la webcam du
commentateur. Dans OBS, place la source video SOUS la Browser Source et
cale-la sur le cadre. Reglages dans `overlay/src/scene.css` :

    --band-w: 420px;      largeur de la bande centrale
    --cam-aspect: 16 / 9; cadrage de la fenetre

## Bac a sable : voir la scene sans client League

    npx tsx tools/sandbox.ts milieu-draft     # sert l'overlay avec un etat fige
    node tools/shot.mjs milieu-draft          # capture 1920x1080 dans shots/
    node tools/shot.mjs milieu-draft --damier # verifie les zones transparentes

Les fixtures sont des sessions LCU **brutes** (`tools/fixtures.ts`) qui
passent par le vrai `normalize()` : le bac a sable exerce le meme
pipeline que le direct, seule la source du payload change. Elles ont
`myTeam` et `theirTeam` vides, comme en spectate.

Fixtures : `milieu-draft`, `phase-bans`, `draft-finie`.

Le mode `--damier` glisse un damier magenta derriere la page. Tout ce qui
le laisse voir est un trou reellement transparent, donc une zone ou la
source video d'OBS apparaitra. Un rectangle noir sur une capture
ordinaire ne prouve rien : noir et transparent se ressemblent sur fond
sombre, et on ne s'en apercoit qu'en direct.

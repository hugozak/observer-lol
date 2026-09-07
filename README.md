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

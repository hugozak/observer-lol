import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadChampions } from './champions.js';
import { normalize, EMPTY_STATE, type DraftState, type RawSession } from './normalize.js';
import { diff } from './events.js';
import { startServer } from './server.js';

/**
 * Rejoue un enregistrement produit par `npm run record`, en respectant les
 * intervalles d'origine. C'est ce qui te permet de travailler ton overlay
 * avec une vraie draft qui tourne en boucle, sans mobiliser dix joueurs.
 *
 *   npm run replay -- recordings/draft-1234.ndjson --speed 2
 */

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--')) ?? 'recordings/latest.ndjson';
const speed = Number(args[args.indexOf('--speed') + 1]) || 1;
const PORT = Number(process.env.PORT ?? 9001);

type Frame = { t: number; data: RawSession | null };

let state: DraftState = EMPTY_STATE;
const server = startServer(PORT, join(process.cwd(), process.env.PUBLIC_DIR ?? 'public'), () => state);

function apply(raw: RawSession | null) {
  const next = normalize(raw);
  const events = diff(state, next);
  state = next;
  server.broadcast({ kind: 'state', state });
  if (events.length) server.broadcast({ kind: 'events', events });
}

async function main() {
  await loadChampions();

  const lines = (await readFile(file, 'utf8')).trim().split('\n');
  const frames: Frame[] = lines.map((l) => JSON.parse(l));
  console.log(`  ${frames.length} frames, vitesse x${speed}`);

  for (;;) {
    const start = frames[0].t;
    for (const [i, frame] of frames.entries()) {
      if (i > 0) {
        const wait = (frame.t - frames[i - 1].t) / speed;
        await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
      }
      apply(frame.data);
      process.stdout.write(`\r  t+${Math.round((frame.t - start) / 1000)}s   `);
    }
    console.log('\n  fin, on reboucle dans 3s');
    await new Promise((r) => setTimeout(r, 3000));
    apply(null);
  }
}

main();

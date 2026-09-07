import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { waitForClient, clientIsGone, type Credentials } from './lockfile.js';
import { connectLcuSocket, lcuGet } from './lcu.js';
import { loadChampions, championCount } from './champions.js';
import { normalize, EMPTY_STATE, type DraftState, type RawSession } from './normalize.js';
import { diff } from './events.js';
import { startServer } from './server.js';

const PORT = Number(process.env.PORT ?? 9001);
const PUBLIC_DIR = join(process.cwd(), 'public');
const RECORD = process.env.RECORD === '1';
const RECORD_FILE = join(process.cwd(), 'recordings', `draft-${Date.now()}.ndjson`);

let state: DraftState = EMPTY_STATE;

const server = startServer(PORT, PUBLIC_DIR, () => state);

/** Applique une session brute : normalise, diffe, diffuse. */
function apply(raw: RawSession | null) {
  const next = normalize(raw);
  const events = diff(state, next);
  state = next;

  server.broadcast({ kind: 'state', state });
  if (events.length) {
    server.broadcast({ kind: 'events', events });
    for (const e of events) console.log('  <', e.type, 'championName' in e ? e.championName : '');
  }
}

async function record(raw: unknown) {
  if (!RECORD) return;
  await mkdir(join(process.cwd(), 'recordings'), { recursive: true });
  await appendFile(RECORD_FILE, JSON.stringify({ t: Date.now(), data: raw }) + '\n');
}

async function session(creds: Credentials) {
  // Etat initial : si le collecteur demarre alors que la draft est deja
  // lancee, le WebSocket ne rejouera pas le passe. Il faut un GET.
  const initial = await lcuGet<RawSession>(creds, '/lol-champ-select/v1/session');
  apply(initial);
  await record(initial);

  await new Promise<void>((resolve) => {
    const ws = connectLcuSocket(creds, {
      onOpen: () => console.log('  connecte au client (port %d)', creds.port),
      onEvent: (event) => {
        // eventType Delete = la draft se termine, data devient null.
        const raw = event.eventType === 'Delete' ? null : (event.data as RawSession);
        apply(raw);
        void record(raw);
      },
      onClose: () => {
        console.log('  deconnecte du client');
        apply(null);
        resolve();
      },
    });

    // Le lockfile disparait a la fermeture du client, mais le socket peut
    // rester ouvert quelques secondes. On coupe court.
    const guard = setInterval(() => {
      if (clientIsGone()) {
        clearInterval(guard);
        ws.close();
      }
    }, 3000);
  });
}

async function main() {
  await loadChampions();
  console.log(`  ${championCount()} champions charges`);
  if (RECORD) console.log(`  enregistrement -> ${RECORD_FILE}`);

  // Boucle de vie : le client peut etre relance entre deux parties, avec
  // un nouveau port et un nouveau mot de passe a chaque fois.
  for (;;) {
    console.log('  attente du client League...');
    const creds = await waitForClient();
    try {
      await session(creds);
    } catch (err) {
      console.error('  erreur de session :', (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main();

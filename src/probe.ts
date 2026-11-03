import { readCredentials } from './lockfile.js';
import { lcuGet } from './lcu.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Sonde de diagnostic. Son seul but est de repondre a une question :
 * un client League en position de SPECTATEUR voit-il la champ select,
 * et avec les deux equipes ?
 *
 *   npm run probe
 *
 * A lancer deux fois : une fois en jouant la custom toi-meme, une fois
 * en spectateur dans le lobby. La sortie console suffit a trancher ;
 * le dump JSON complet est ecrit dans probes/ pour qu'on regarde la
 * forme exacte des champs si besoin.
 */

/* Les endpoints plausibles, du plus attendu au plus exotique.
   - champ-select/v1/session : celui sur lequel repose le projet
   - champ-select-legacy     : les parties personnalisees passent parfois
                               par l'ancien service, qui a survecu
   - team-builder            : alias historique du meme service
   - gameflow/v1/session     : porte gameData.teamOne / teamTwo avec les
                               noms de joueurs, meme quand champ-select
                               est muet. C'est notre filet de secours
                               pour la saisie des pseudos.
   - lobby/v2/lobby          : composition du lobby cote observateur
   - spectator               : confirme qu'on est bien en spectate        */
const ENDPOINTS = [
  '/lol-gameflow/v1/gameflow-phase',
  '/lol-champ-select/v1/session',
  '/lol-champ-select-legacy/v1/session',
  '/lol-lobby-team-builder/champ-select/v1/session',
  '/lol-gameflow/v1/session',
  '/lol-lobby/v2/lobby',
  '/lol-lobby/v2/lobby/members',
  '/lol-spectator/v1/spectate',
  '/lol-champ-select/v1/pickable-champion-ids',
];

type Probe = { path: string; status: string; body: unknown };

function short(v: unknown): string {
  const s = JSON.stringify(v);
  if (s === undefined) return 'undefined';
  return s.length > 160 ? s.slice(0, 157) + '...' : s;
}

/** Ce qu'on veut vraiment savoir de /lol-champ-select/v1/session. */
function analyseSession(body: any): string[] {
  const lines: string[] = [];
  const my = body?.myTeam ?? [];
  const their = body?.theirTeam ?? [];
  const actions: any[] = (body?.actions ?? []).flat();

  lines.push(`localPlayerCellId   ${body?.localPlayerCellId}  (-1 attendu en spectate)`);
  lines.push(`myTeam              ${my.length} joueurs`);
  lines.push(`theirTeam           ${their.length} joueurs`);

  // LE point decisif : combien de cellId distincts sont visibles, et
  // couvrent-ils les deux equipes (0-4 et 5-9) ?
  const cells = new Set<number>();
  for (const p of [...my, ...their]) cells.add(p.cellId);
  for (const a of actions) cells.add(a.actorCellId);
  const sorted = [...cells].filter((c) => c >= 0).sort((a, b) => a - b);
  const blue = sorted.filter((c) => c < 5);
  const red = sorted.filter((c) => c >= 5);
  lines.push(`cellId visibles     [${sorted.join(', ')}]`);
  lines.push(`  cote bleu (0-4)   ${blue.length}/5`);
  lines.push(`  cote rouge (5-9)  ${red.length}/5   <-- si 0, le spectate ne voit qu'une equipe`);

  lines.push(`actions             ${actions.length} au total, ${(body?.actions ?? []).length} groupes`);
  const types = new Map<string, number>();
  for (const a of actions) types.set(a.type, (types.get(a.type) ?? 0) + 1);
  lines.push(`  par type          ${[...types].map(([t, n]) => `${t}=${n}`).join(' ')}`);

  // Les intents adverses fuitent-ils ? Determine si on peut afficher les
  // hovers, et si on risque de spoiler un ban non verrouille.
  const hovering = actions.filter((a) => a.championId > 0 && !a.completed);
  lines.push(`hovers visibles     ${hovering.length} action(s) avec championId mais non completed`);
  if (hovering.length) {
    lines.push(`  ${hovering.map((a) => `cell${a.actorCellId}:${a.type}:${a.championId}`).join(' ')}`);
  }

  // Y a-t-il un nom de joueur exploitable quelque part ?
  const sample = my[0] ?? their[0];
  if (sample) {
    const nameKeys = Object.keys(sample).filter((k) => /name|puuid|summonerId/i.test(k));
    lines.push(`champs de nom       ${nameKeys.map((k) => `${k}=${short(sample[k])}`).join('  ') || 'aucun'}`);
  }

  lines.push(`timer               ${short(body?.timer)}`);
  return lines;
}

async function main() {
  const creds = await readCredentials();
  if (!creds) {
    console.error('Lockfile introuvable. Le client League est-il lance ?');
    console.error('Force le chemin avec LEAGUE_LOCKFILE=... si ton install est ailleurs.');
    process.exit(1);
  }
  console.log(`Client sur le port ${creds.port} (protocole ${creds.protocol})\n`);

  const results: Probe[] = [];

  for (const path of ENDPOINTS) {
    let status = 'ok';
    let body: unknown = null;
    try {
      body = await lcuGet<unknown>(creds, path);
      if (body === null) status = '404 (absent)';
    } catch (err) {
      status = (err as Error).message;
    }
    results.push({ path, status, body });

    const flag = status === 'ok' ? '  OK  ' : status.startsWith('404') ? ' vide ' : ' ERR  ';
    console.log(`[${flag}] ${path}`);
    if (status === 'ok') console.log(`         ${short(body)}`);
    else if (status !== '404 (absent)') console.log(`         ${status}`);
  }

  /* --- le verdict ------------------------------------------------- */
  const session =
    results.find((r) => r.path === '/lol-champ-select/v1/session' && r.status === 'ok')?.body ??
    results.find((r) => r.path.includes('champ-select') && r.status === 'ok' && r.body)?.body;

  console.log('\n--- champ select ------------------------------------------');
  if (!session) {
    console.log('Aucun endpoint de champ select ne repond.');
    console.log('Si tu es bien dans une draft en cours, regarde gameflow-phase');
    console.log('ci-dessus : ChampSelect attendu. Sinon relance la sonde au');
    console.log('bon moment, la session n existe que pendant la draft.');
  } else {
    for (const line of analyseSession(session)) console.log(line);
  }

  const dir = join(process.cwd(), 'probes');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `probe-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(results, null, 2));
  console.log(`\nDump complet -> ${file}`);
}

main();

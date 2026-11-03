import { join } from 'node:path';
import { FIXTURES, CHAMPION_SUMMARY } from './fixtures.js';

/**
 * Bac a sable : sert l'overlay avec un etat figé, sans client League.
 *
 *   npx tsx tools/sandbox.ts milieu-draft
 *
 * Le but est de pouvoir regarder la scene a un instant precis de la
 * draft, autant de fois qu'on veut. C'est le meme serveur et le meme
 * normalize() qu'en direct : seule la source du payload change.
 */

// Le catalogue de champions vient normalement de CommunityDragon. Ici on
// le stub, parce qu'un bac a sable ne doit pas dependre du reseau pour
// afficher une scene.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: unknown) => {
  if (String(url).includes('champion-summary.json')) {
    return { json: async () => CHAMPION_SUMMARY } as Response;
  }
  return realFetch(url as string, init as RequestInit);
}) as typeof fetch;

const { loadChampions } = await import('../src/champions.js');
const { normalize } = await import('../src/normalize.js');
const { startServer } = await import('../src/server.js');

const name = process.argv[2] ?? 'milieu-draft';
const raw = FIXTURES[name];
if (!raw) {
  console.error(`Fixture inconnue : ${name}`);
  console.error(`Disponibles : ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

await loadChampions();
const state = normalize(raw);

const PORT = Number(process.env.PORT ?? 9001);
startServer(PORT, join(process.cwd(), process.env.PUBLIC_DIR ?? 'public'), () => ({
  // receivedAt est reevalue a chaque connexion : sinon le decompte de
  // l'overlay, qui se cale sur Date.now() - receivedAt, afficherait
  // 0:00 des que le bac a sable tourne depuis plus de 30 secondes.
  ...state,
  timer: { ...state.timer, receivedAt: Date.now() },
}));

console.log(`  fixture   ${name}`);
console.log(`  bans      bleu ${state.teams.blue.bans.length}, rouge ${state.teams.red.bans.length}`);
console.log(`  picks     bleu ${state.teams.blue.picks.length}, rouge ${state.teams.red.picks.length}`);
console.log(`  en cours  ${state.current ? `${state.current.team} ${state.current.type}` : 'personne'}`);

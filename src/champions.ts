const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1';

export type Champion = {
  id: number;
  name: string;
  alias: string;
  iconUrl: string;
  splashUrl: string;
};

type Summary = { id: number; name: string; alias: string };

let cache = new Map<number, Champion>();

/**
 * CommunityDragon expose un chemin "latest" : pas de numero de version a
 * mettre a jour a chaque patch, contrairement a Data Dragon.
 * A appeler une fois au demarrage, et a rafraichir apres un patch.
 */
export async function loadChampions(): Promise<void> {
  const res = await fetch(`${CDRAGON}/champion-summary.json`);
  const list = (await res.json()) as Summary[];

  const next = new Map<number, Champion>();
  for (const c of list) {
    if (c.id <= 0) continue; // -1 est l'entree "aucun champion"
    next.set(c.id, {
      id: c.id,
      name: c.name,
      alias: c.alias,
      iconUrl: `${CDRAGON}/champion-icons/${c.id}.png`,
      splashUrl: `${CDRAGON}/champion-splashes/${c.id}/${c.id}000.jpg`,
    });
  }
  cache = next;
}

export function getChampion(id: number): Champion | null {
  return cache.get(id) ?? null;
}

export function championCount(): number {
  return cache.size;
}

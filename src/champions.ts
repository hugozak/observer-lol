const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1';
const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn';

export type Champion = {
  id: number;
  name: string;
  alias: string;
  iconUrl: string;
  splashUrl: string;
  /** Repli quand artUrl ne charge pas : voir le commentaire plus bas. */
  artFallbackUrl: string;
  /** Artwork de l'ecran de chargement, cadrage portrait 308x560.
   *  C'est le seul asset officiel deja cadre pour une colonne verticale :
   *  un splash paysage recadre coupe la tete du champion une fois sur deux. */
  artUrl: string;
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
      artUrl: `${DDRAGON}/img/champion/loading/${c.alias}_0.jpg`,
      // artUrl est construit depuis l'alias CommunityDragon, mais Data
      // Dragon utilise ses propres cles et les deux referentiels
      // divergent sur quelques champions (le cas classique : CDragon
      // "FiddleSticks" contre DDragon "Fiddlesticks"). Un 404 = un
      // panneau sans artwork en plein cast. CDragon indexe par id
      // numerique, donc ce repli ne peut pas se tromper de cle ;
      // c'est un cadrage paysage, a recadrer en CSS.
      artFallbackUrl: `${CDRAGON}/champion-splashes/${c.id}/${c.id}000.jpg`,
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

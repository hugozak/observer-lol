import { getChampion } from './champions.js';

/* ------------------------------------------------------------------ */
/* Forme brute renvoyee par le LCU                                     */
/* ------------------------------------------------------------------ */

type RawAction = {
  id: number;
  actorCellId: number;
  championId: number;
  type: 'ban' | 'pick' | string;
  completed: boolean;
  isInProgress: boolean;
};

type RawPlayer = {
  cellId: number;
  championId: number;
  championPickIntent: number;
  assignedPosition: string;
  summonerId: number;
  /** Souvent absents ou masques. On les relaie si presents, sans y compter. */
  gameName?: string;
  summonerName?: string;
};

export type RawSession = {
  localPlayerCellId: number;
  timer: { phase: string; adjustedTimeLeftInPhase: number; totalTimeInPhase?: number };
  myTeam: RawPlayer[];
  theirTeam: RawPlayer[];
  actions: RawAction[][];
};

/* ------------------------------------------------------------------ */
/* Modele metier envoye a l'overlay                                    */
/* ------------------------------------------------------------------ */

export type Team = 'blue' | 'red';

export type PickSlot = {
  cellId: number;
  /** position dans l'equipe, 0 a 4. Stable, sert de cle de rendu. */
  slotIndex: number;
  position: string;
  /** Pseudo si le client le donne, null sinon. A completer a la main. */
  playerName: string | null;
  championId: number;
  championName: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
  artUrl: string | null;
  artFallbackUrl: string | null;
  /** true quand le joueur survole sans avoir valide */
  hovering: boolean;
  /** true quand l'action est verrouillee */
  locked: boolean;
};

export type BanSlot = {
  index: number;
  championId: number;
  championName: string | null;
  iconUrl: string | null;
  locked: boolean;
};

export type CurrentAction = {
  actionId: number;
  type: 'ban' | 'pick';
  team: Team;
  cellId: number;
  /** position du slot dans son equipe, 0 a 4 */
  slotIndex: number;
};

export type DraftState = {
  active: boolean;
  phase: string;
  timer: { msLeft: number; msTotal: number; receivedAt: number };
  current: CurrentAction | null;
  teams: Record<Team, { picks: PickSlot[]; bans: BanSlot[] }>;
};

export const EMPTY_STATE: DraftState = {
  active: false,
  phase: 'NONE',
  timer: { msLeft: 0, msTotal: 0, receivedAt: 0 },
  current: null,
  teams: {
    blue: { picks: [], bans: [] },
    red: { picks: [], bans: [] },
  },
};

/* ------------------------------------------------------------------ */

/**
 * On deduit l'equipe du cellId plutot que de se fier a myTeam/theirTeam.
 * En spectate le client n'appartient a aucune equipe (localPlayerCellId
 * vaut -1), donc "myTeam" n'a plus de sens cote observateur. En revanche
 * la convention des cellId est stable : 0-4 cote bleu, 5-9 cote rouge.
 */
function teamOf(cellId: number): Team {
  return cellId < 5 ? 'blue' : 'red';
}

function slotIndexOf(cellId: number): number {
  return cellId % 5;
}

function decorate(championId: number) {
  const champ = championId > 0 ? getChampion(championId) : null;
  return {
    championName: champ?.name ?? null,
    iconUrl: champ?.iconUrl ?? null,
    splashUrl: champ?.splashUrl ?? null,
    artUrl: champ?.artUrl ?? null,
    artFallbackUrl: champ?.artFallbackUrl ?? null,
  };
}

export function normalize(session: RawSession | null): DraftState {
  if (!session) return EMPTY_STATE;

  const players = [...(session.myTeam ?? []), ...(session.theirTeam ?? [])];
  const actions = (session.actions ?? []).flat();

  const teams: DraftState['teams'] = {
    blue: { picks: [], bans: [] },
    red: { picks: [], bans: [] },
  };

  /* --- les picks --------------------------------------------------- */
  /*
   * On ne construit PAS les slots depuis myTeam/theirTeam. En spectate
   * le client n'appartient a aucune equipe, et rien ne garantit que ces
   * tableaux soient remplis : s'ils sont vides, une boucle sur eux ne
   * produit aucun slot et l'overlay reste noir toute la draft.
   *
   * La structure fiable est `actions`. Le client y declare les dix
   * actions de pick des l'ouverture de la draft, completees ou non,
   * chacune avec son actorCellId. C'est donc elle qui definit quels
   * slots existent ; myTeam/theirTeam ne sert plus qu'a enrichir
   * (position assignee, pseudo) quand l'information est la.
   */
  const byCell = new Map<number, RawPlayer>();
  for (const p of players) if (p.cellId >= 0) byCell.set(p.cellId, p);

  const pickActions = actions.filter((a) => a.type === 'pick');

  const cellIds = new Set<number>();
  for (const a of pickActions) if (a.actorCellId >= 0) cellIds.add(a.actorCellId);
  for (const cell of byCell.keys()) cellIds.add(cell);

  for (const cellId of [...cellIds].sort((a, b) => a - b)) {
    const player = byCell.get(cellId);
    const action = pickActions.find((a) => a.actorCellId === cellId);

    // championId non nul + completed false = le joueur survole un champion.
    // C'est ce qui permet d'afficher le hover en direct.
    const championId =
      action?.championId || player?.championId || player?.championPickIntent || 0;
    const locked = action?.completed ?? false;

    teams[teamOf(cellId)].picks.push({
      cellId,
      slotIndex: slotIndexOf(cellId),
      position: player?.assignedPosition ?? '',
      playerName: player?.gameName || player?.summonerName || null,
      championId,
      hovering: championId > 0 && !locked,
      locked,
      ...decorate(championId),
    });
  }

  for (const team of ['blue', 'red'] as Team[]) {
    teams[team].picks.sort((a, b) => a.cellId - b.cellId);
  }

  /* --- les bans, dans l'ordre chronologique ----------------------- */
  /*
   * On ne garde que les bans verrouilles. Les dix actions de ban
   * existent des l'ouverture de la draft, et une action en cours porte
   * deja le championId survole : les relayer telles quelles afficherait
   * a l'antenne un ban avant qu'il soit valide. A l'ecran, un ban
   * n'existe qu'une fois completed.
   */
  const banActions = actions
    .filter((a) => a.type === 'ban' && a.completed && a.championId > 0)
    .sort((a, b) => a.id - b.id);

  for (const action of banActions) {
    const team = teamOf(action.actorCellId);
    const { championName, iconUrl } = decorate(action.championId);
    teams[team].bans.push({
      index: teams[team].bans.length,
      championId: action.championId,
      championName,
      iconUrl,
      locked: true,
    });
  }

  /* --- l'action en cours ------------------------------------------ */
  // Le client dit lui-meme qui joue, via isInProgress. Rien a deduire.
  const inProgress = actions.find((a) => a.isInProgress);
  const current: CurrentAction | null = inProgress
    ? {
        actionId: inProgress.id,
        type: inProgress.type === 'ban' ? 'ban' : 'pick',
        team: teamOf(inProgress.actorCellId),
        cellId: inProgress.actorCellId,
        slotIndex: slotIndexOf(inProgress.actorCellId),
      }
    : null;

  return {
    active: true,
    phase: session.timer?.phase ?? 'UNKNOWN',
    // Le timer est une photo a l'instant du message. On joint receivedAt
    // pour que l'overlay puisse faire tourner son propre decompte et se
    // resynchroniser a chaque message plutot que d'attendre un tick.
    timer: {
      msLeft: session.timer?.adjustedTimeLeftInPhase ?? 0,
      // La duree de la phase varie : ~27s pour un ban, 30s pour un pick,
      // et une custom peut etre configuree autrement. Une barre de
      // progression codee sur 30s en dur serait fausse la moitie du temps.
      msTotal: session.timer?.totalTimeInPhase ?? 0,
      receivedAt: Date.now(),
    },
    current,
    teams,
  };
}

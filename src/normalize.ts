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
};

export type RawSession = {
  localPlayerCellId: number;
  timer: { phase: string; adjustedTimeLeftInPhase: number };
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
  position: string;
  championId: number;
  championName: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
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
  timer: { msLeft: number; receivedAt: number };
  current: CurrentAction | null;
  teams: Record<Team, { picks: PickSlot[]; bans: BanSlot[] }>;
};

export const EMPTY_STATE: DraftState = {
  active: false,
  phase: 'NONE',
  timer: { msLeft: 0, receivedAt: 0 },
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

  /* --- les picks, un slot par joueur ------------------------------ */
  for (const player of players) {
    const action = actions.find(
      (a) => a.type === 'pick' && a.actorCellId === player.cellId,
    );

    // championId non nul + completed false = le joueur survole un champion.
    // C'est ce qui permet d'afficher le hover en direct.
    const championId = action?.championId || player.championId || player.championPickIntent || 0;
    const locked = action?.completed ?? false;

    teams[teamOf(player.cellId)].picks.push({
      cellId: player.cellId,
      position: player.assignedPosition ?? '',
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
  const banActions = actions
    .filter((a) => a.type === 'ban')
    .sort((a, b) => a.id - b.id);

  for (const action of banActions) {
    const team = teamOf(action.actorCellId);
    const { championName, iconUrl } = decorate(action.championId);
    teams[team].bans.push({
      index: teams[team].bans.length,
      championId: action.championId,
      championName,
      iconUrl,
      locked: action.completed,
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
      receivedAt: Date.now(),
    },
    current,
    teams,
  };
}

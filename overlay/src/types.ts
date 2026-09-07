export type Team = 'blue' | 'red';

export type PickSlot = {
  cellId: number;
  position: string;
  championId: number;
  championName: string | null;
  iconUrl: string | null;
  splashUrl: string | null;
  hovering: boolean;
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
  slotIndex: number;
};

export type DraftState = {
  active: boolean;
  phase: string;
  timer: { msLeft: number; receivedAt: number };
  current: CurrentAction | null;
  teams: Record<Team, { picks: PickSlot[]; bans: BanSlot[] }>;
};

export type DraftEvent =
  | { type: 'draft.started' }
  | { type: 'draft.ended' }
  | { type: 'turn.changed'; actor: { team: Team; slotIndex: number }; action: 'ban' | 'pick' }
  | { type: 'pick.hovered'; team: Team; slotIndex: number; championId: number; championName: string | null }
  | { type: 'pick.locked'; team: Team; slotIndex: number; championId: number; championName: string | null }
  | { type: 'ban.locked'; team: Team; index: number; championId: number; championName: string | null };

export const EMPTY_STATE: DraftState = {
  active: false,
  phase: 'NONE',
  timer: { msLeft: 0, receivedAt: 0 },
  current: null,
  teams: { blue: { picks: [], bans: [] }, red: { picks: [], bans: [] } },
};

/** Noms de roles en francais, dans l'ordre d'affichage des slots. */
export const ROLES = ['top', 'jungle', 'mid', 'bot', 'support'];

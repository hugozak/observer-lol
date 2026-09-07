import type { DraftState, PickSlot, Team } from './types';
import { EMPTY_STATE } from './types';

const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons';

function pick(cellId: number, position: string, id: number, name: string, locked: boolean): PickSlot {
  return {
    cellId, position,
    championId: id,
    championName: name,
    iconUrl: `${CDRAGON}/${id}.png`,
    splashUrl: null,
    hovering: !locked,
    locked,
  };
}

function empty(cellId: number, position: string): PickSlot {
  return {
    cellId, position,
    championId: 0, championName: null, iconUrl: null, splashUrl: null,
    hovering: false, locked: false,
  };
}

function ban(index: number, id: number, name: string) {
  return { index, championId: id, championName: name, iconUrl: `${CDRAGON}/${id}.png`, locked: true };
}

function base(): DraftState {
  return {
    active: true,
    phase: 'BAN_PICK',
    timer: { msLeft: 24000, receivedAt: Date.now() },
    current: null,
    teams: {
      blue: { picks: [0, 1, 2, 3, 4].map((i) => empty(i, ['top', 'jungle', 'mid', 'bot', 'support'][i])), bans: [] },
      red:  { picks: [5, 6, 7, 8, 9].map((i) => empty(i, ['top', 'jungle', 'mid', 'bot', 'support'][i - 5])), bans: [] },
    },
  };
}

/**
 * Les etats de reference du design. C'est ce qui te permet de sauter
 * directement au cas que tu es en train de regler, au lieu d'attendre que
 * le rejeu y arrive.
 */
export const STATES: Record<string, () => DraftState> = {
  'draft vide': () => ({ ...base(), phase: 'PLANNING' }),

  'phase de bans': () => {
    const s = base();
    s.teams.blue.bans = [ban(0, 266, 'Aatrox'), ban(1, 103, 'Ahri'), ban(2, 84, 'Akali')];
    s.teams.red.bans = [ban(0, 12, 'Alistar'), ban(1, 32, 'Amumu')];
    s.current = { actionId: 6, type: 'ban', team: 'red', cellId: 7, slotIndex: 2 };
    return s;
  },

  'mi-draft': () => {
    const s = base();
    s.teams.blue.picks[0] = pick(0, 'top', 516, 'Ornn', true);
    s.teams.blue.picks[1] = pick(1, 'jungle', 113, 'Sejuani', true);
    s.teams.blue.picks[2] = pick(2, 'mid', 61, 'Orianna', true);
    s.teams.red.picks[0] = pick(5, 'top', 897, "K'Sante", true);
    s.teams.red.picks[3] = pick(8, 'bot', 145, "Kai'Sa", false);
    s.teams.red.picks[4] = pick(9, 'support', 497, 'Rakan', true);
    s.teams.blue.bans = [ban(0, 266, 'Aatrox'), ban(1, 103, 'Ahri'), ban(2, 84, 'Akali')];
    s.teams.red.bans = [ban(0, 12, 'Alistar'), ban(1, 32, 'Amumu'), ban(2, 34, 'Anivia')];
    s.current = { actionId: 18, type: 'pick', team: 'red', cellId: 8, slotIndex: 3 };
    return s;
  },

  'chrono critique': () => {
    const s = STATES['mi-draft']();
    s.timer = { msLeft: 3000, receivedAt: Date.now() };
    return s;
  },

  'draft complete': () => {
    const s = STATES['mi-draft']();
    (['blue', 'red'] as Team[]).forEach((t) =>
      s.teams[t].picks.forEach((p, i) => {
        if (!p.championId) s.teams[t].picks[i] = pick(p.cellId, p.position, 64 + i, 'Lee Sin', true);
        p.locked = true;
        p.hovering = false;
      }),
    );
    s.current = null;
    return s;
  },

  'aucune draft': () => EMPTY_STATE,
};

export function DevPanel({ onPick }: { onPick: (state: DraftState) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 99,
      display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 520,
      font: '13px system-ui', background: '#0d1013', padding: 8, borderRadius: 6,
    }}>
      {Object.keys(STATES).map((key) => (
        <button
          key={key}
          onClick={() => onPick(STATES[key]())}
          style={{
            background: '#20272e', color: '#e8e4da', border: '1px solid #333c45',
            padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
          }}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

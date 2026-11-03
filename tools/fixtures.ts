import type { RawSession } from '../src/normalize.js';

/**
 * Moments de reference, sous la forme BRUTE du LCU. On passe par
 * normalize() comme en direct : le bac a sable exerce le vrai pipeline,
 * pas une maquette d'etat ecrite a la main qui finirait par diverger.
 */

type A = RawSession['actions'][number][number];

const ban = (id: number, cell: number, champ: number, done = true): A =>
  ({ id, actorCellId: cell, championId: champ, type: 'ban', completed: done, isInProgress: false });

const pick = (id: number, cell: number, champ: number, done = true, now = false): A =>
  ({ id, actorCellId: cell, championId: champ, type: 'pick', completed: done, isInProgress: now });

/** Les dix actions de pick existent des l'ouverture, vides et non completees. */
const pendingPicks = (from: number, cells: number[]): A[] =>
  cells.map((c, i) => pick(from + i, c, 0, false));

function session(parts: {
  phase: string; msLeft: number; msTotal: number; actions: A[][];
}): RawSession {
  return {
    // -1 : c'est ce que vaut localPlayerCellId cote spectateur. Les deux
    // tableaux d'equipe sont vides a dessein, c'est le cas qui faisait
    // precedemment un ecran noir.
    localPlayerCellId: -1,
    timer: { phase: parts.phase, adjustedTimeLeftInPhase: parts.msLeft, totalTimeInPhase: parts.msTotal },
    myTeam: [], theirTeam: [],
    actions: parts.actions,
  };
}

export const FIXTURES: Record<string, RawSession> = {
  /* Ordre de la draft tournoi : 3 bans par equipe, puis
     B1 R1 R2 B2 B3 R3, puis 2 bans, puis R4 B4 B5 R5. */

  'milieu-draft': session({
    phase: 'BAN_PICK', msLeft: 21400, msTotal: 30000,
    actions: [
      [ban(0, 0, 266), ban(1, 5, 12)],          // Aatrox / Alistar
      [ban(2, 1, 103), ban(3, 6, 32)],          // Ahri / Amumu
      [ban(4, 2, 84), ban(5, 7, 238)],          // Akali / Zed
      [pick(6, 0, 64)],                          // B1 Lee Sin
      [pick(7, 5, 897), pick(8, 6, 234)],        // R1 K'Sante, R2 Viego
      [pick(9, 1, 61), pick(10, 2, 222)],        // B2 Orianna, B3 Jinx
      [pick(11, 7, 268, false, true)],           // R3 Azir, en cours de survol
      ...[pendingPicks(12, [8, 3, 4, 9])],       // le reste a venir
    ],
  }),

  'phase-bans': session({
    phase: 'BAN_PICK', msLeft: 14200, msTotal: 27000,
    actions: [
      [ban(0, 0, 266), ban(1, 5, 12)],
      [ban(2, 1, 103), ban(3, 6, 32)],
      [ban(4, 2, 84, false), ban(5, 7, 238, false, )],
      pendingPicks(6, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    ],
  }),

  'draft-finie': session({
    phase: 'FINALIZATION', msLeft: 4100, msTotal: 10000,
    actions: [
      [ban(0, 0, 266), ban(1, 5, 12)],
      [ban(2, 1, 103), ban(3, 6, 32)],
      [ban(4, 2, 84), ban(5, 7, 238)],
      [ban(6, 3, 157), ban(7, 8, 777)],
      [ban(8, 4, 245), ban(9, 9, 141)],
      [pick(10, 0, 64), pick(11, 1, 61), pick(12, 2, 222), pick(13, 3, 412), pick(14, 4, 875)],
      [pick(15, 5, 897), pick(16, 6, 234), pick(17, 7, 268), pick(18, 8, 51), pick(19, 9, 350)],
    ],
  }),
};

/** Mettre a jour quand une fixture reference un champion de plus. */
export const CHAMPION_SUMMARY = [
  { id: 266, name: 'Aatrox', alias: 'Aatrox' },
  { id: 103, name: 'Ahri', alias: 'Ahri' },
  { id: 84, name: 'Akali', alias: 'Akali' },
  { id: 12, name: 'Alistar', alias: 'Alistar' },
  { id: 32, name: 'Amumu', alias: 'Amumu' },
  { id: 238, name: 'Zed', alias: 'Zed' },
  { id: 64, name: 'Lee Sin', alias: 'LeeSin' },
  { id: 61, name: 'Orianna', alias: 'Orianna' },
  { id: 222, name: 'Jinx', alias: 'Jinx' },
  { id: 897, name: "K'Sante", alias: 'KSante' },
  { id: 234, name: 'Viego', alias: 'Viego' },
  { id: 268, name: 'Azir', alias: 'Azir' },
  { id: 412, name: 'Thresh', alias: 'Thresh' },
  { id: 875, name: 'Sett', alias: 'Sett' },
  { id: 51, name: 'Caitlyn', alias: 'Caitlyn' },
  { id: 350, name: 'Yuumi', alias: 'Yuumi' },
  { id: 157, name: 'Yasuo', alias: 'Yasuo' },
  { id: 777, name: 'Yone', alias: 'Yone' },
  { id: 245, name: 'Ekko', alias: 'Ekko' },
  { id: 141, name: 'Kayn', alias: 'Kayn' },
];

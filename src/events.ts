import type { DraftState, Team } from './normalize.js';

/**
 * L'etat complet suffit a peindre l'ecran, mais pas a declencher une
 * animation : l'overlay a besoin de savoir que "ce pick vient d'etre
 * verrouille", pas seulement qu'il l'est. On derive donc des evenements
 * discrets en comparant l'etat precedent au nouveau.
 */
export type DraftEvent =
  | { type: 'draft.started' }
  | { type: 'draft.ended' }
  | { type: 'turn.changed'; actor: { team: Team; slotIndex: number }; action: 'ban' | 'pick' }
  | { type: 'pick.hovered'; team: Team; slotIndex: number; championId: number; championName: string | null }
  | { type: 'pick.locked'; team: Team; slotIndex: number; championId: number; championName: string | null }
  | { type: 'ban.locked'; team: Team; index: number; championId: number; championName: string | null };

export function diff(prev: DraftState, next: DraftState): DraftEvent[] {
  const events: DraftEvent[] = [];

  if (prev.active && !next.active) return [{ type: 'draft.ended' }];
  if (!next.active) return [];

  /*
   * Transition vide -> active : on annonce le demarrage et RIEN d'autre.
   * Ce cas n'est pas seulement le debut d'une draft, c'est aussi le
   * collecteur qui redemarre en pleine draft (ou qui se reconnecte au
   * client). L'etat de depart est alors deja peuple, et diffuser les
   * verrous deja acquis declencherait dix animations simultanees a
   * l'antenne. L'etat complet suffit a peindre l'ecran ; les
   * evenements ne servent qu'aux transitions reellement vues.
   */
  if (!prev.active) return [{ type: 'draft.started' }];

  /* --- changement de tour ----------------------------------------- */
  if (next.current && next.current.actionId !== prev.current?.actionId) {
    events.push({
      type: 'turn.changed',
      actor: { team: next.current.team, slotIndex: next.current.slotIndex },
      action: next.current.type,
    });
  }

  /* --- picks ------------------------------------------------------- */
  for (const team of ['blue', 'red'] as Team[]) {
    // Index par cellId : le nombre de slots peut varier d'un message a
    // l'autre (un joueur qui rejoint, myTeam qui se remplit en cours de
    // route cote spectateur). Comparer position par position dans le
    // tableau ferait glisser les paires et produirait de faux verrous.
    const prevByCell = new Map(prev.teams[team].picks.map((p) => [p.cellId, p]));

    next.teams[team].picks.forEach((slot) => {
      const before = prevByCell.get(slot.cellId);
      const i = slot.slotIndex;

      if (!before?.locked && slot.locked) {
        events.push({
          type: 'pick.locked',
          team,
          slotIndex: i,
          championId: slot.championId,
          championName: slot.championName,
        });
        return;
      }

      // Hover : on n'emet que sur changement de champion, sinon on
      // repeterait l'evenement a chaque message recu.
      if (slot.hovering && slot.championId !== before?.championId) {
        events.push({
          type: 'pick.hovered',
          team,
          slotIndex: i,
          championId: slot.championId,
          championName: slot.championName,
        });
      }
    });

    /* --- bans ------------------------------------------------------ */
    next.teams[team].bans.forEach((ban, i) => {
      const before = prev.teams[team].bans[i];
      if (!before?.locked && ban.locked) {
        events.push({
          type: 'ban.locked',
          team,
          index: i,
          championId: ban.championId,
          championName: ban.championName,
        });
      }
    });
  }

  return events;
}

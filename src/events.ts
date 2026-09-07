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

  if (!prev.active && next.active) events.push({ type: 'draft.started' });
  if (prev.active && !next.active) {
    return [{ type: 'draft.ended' }];
  }
  if (!next.active) return events;

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
    next.teams[team].picks.forEach((slot, i) => {
      const before = prev.teams[team].picks[i];

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

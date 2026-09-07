import { ROLES, type BanSlot, type DraftState, type PickSlot, type Team } from './types';
import { useCountdown } from './useDraftState';

const TEAM_NAMES: Record<Team, string> = {
  blue: 'Les Mecs du Fond',
  red: 'Anjou Academy',
};

function Slot({ slot, role, side, active }: {
  slot: PickSlot | undefined;
  role: string;
  side: Team;
  active: boolean;
}) {
  // L'etat se lit a la structure : creux, contour colore, ou bloc plein.
  const status = slot?.locked ? 'locked' : slot?.hovering ? 'hovering' : 'empty';

  return (
    <div className={`slot slot--${status} slot--${side}`} data-active={active || undefined}>
      <div className="slot__edge" />
      {slot?.iconUrl ? (
        <img className="slot__icon" src={slot.iconUrl} alt="" />
      ) : (
        <div className="slot__icon slot__icon--empty" />
      )}
      <div className="slot__text">
        {status === 'empty' ? (
          <span className="slot__role">{role}</span>
        ) : (
          <>
            <span className="slot__champ">{slot?.championName}</span>
            <span className="slot__player">
              {playerName(side, ROLES.indexOf(role))} &middot; {role}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Le LCU ne donne pas les pseudos en spectate quand le mode streamer est
 * actif. En attendant de brancher une saisie manuelle, on affiche un
 * placeholder plutot qu'un vide qui casse la mise en page.
 */
function playerName(side: Team, index: number): string {
  const rosters: Record<Team, string[]> = {
    blue: ['Kaï', 'Milo', 'Nine', 'Sacha', 'Bri'],
    red: ['Lys', 'Nael', 'Ivo', 'Adri', 'Théo'],
  };
  return rosters[side][index] ?? 'joueur';
}

function Ban({ ban }: { ban: BanSlot | undefined }) {
  if (!ban?.iconUrl) return <div className="ban ban--empty" />;
  return (
    <div className="ban">
      <img src={ban.iconUrl} alt={ban.championName ?? ''} />
      <span className="ban__slash" />
    </div>
  );
}

export function DraftScene({ state }: { state: DraftState }) {
  const ms = useCountdown(state.timer.msLeft, state.timer.receivedAt);
  const seconds = Math.ceil(ms / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (!state.active) return <div className="scene scene--idle" />;

  const actor = state.current;
  const caption = actor
    ? `${actor.type === 'ban' ? 'ban' : 'pick'} en cours · ${playerName(actor.team, actor.slotIndex)}, ${ROLES[actor.slotIndex]}`
    : state.phase.toLowerCase();

  return (
    <div className="scene">
      {(['blue', 'red'] as Team[]).map((side) => (
        <div key={side} className={`column column--${side}`}>
          <h1 className="column__name">{TEAM_NAMES[side]}</h1>
          <div className="column__slots">
            {ROLES.map((role, i) => (
              <Slot
                key={role}
                role={role}
                side={side}
                slot={state.teams[side].picks[i]}
                active={actor?.type === 'pick' && actor.team === side && actor.slotIndex === i}
              />
            ))}
          </div>
          <div className="column__bans">
            {[0, 1, 2, 3, 4].map((i) => (
              <Ban key={i} ban={state.teams[side].bans[i]} />
            ))}
          </div>
        </div>
      ))}

      <div className="center">
        <div className="center__clock">{clock}</div>
        <div className="center__track">
          <div
            className="center__fill"
            data-team={actor?.team}
            style={{ width: `${Math.min(100, (ms / 30000) * 100)}%` }}
          />
        </div>
        <div className="center__caption">{caption}</div>
      </div>
    </div>
  );
}

import { ROLES, type BanSlot, type DraftState, type PickSlot, type Team } from './types';
import { useCountdown } from './useDraftState';

const TEAMS: Record<Team, { name: string; score: number }> = {
  blue: { name: 'Les Mecs du Fond', score: 1 },
  red: { name: 'Anjou Academy', score: 0 },
};

const ROSTERS: Record<Team, string[]> = {
  blue: ['Kaï', 'Milo', 'Nine', 'Sacha', 'Bri'],
  red: ['Lys', 'Nael', 'Ivo', 'Adri', 'Théo'],
};

/** Le LCU ne donne pas toujours les pseudos en spectate. */
function playerName(side: Team, index: number): string {
  return ROSTERS[side][index] ?? 'joueur';
}

function Panel({ slot, role, side, active, index }: {
  slot: PickSlot | undefined;
  role: string;
  side: Team;
  active: boolean;
  index: number;
}) {
  const status = slot?.locked ? 'locked' : slot?.hovering ? 'hovering' : 'empty';

  return (
    <div className={`panel panel--${status} panel--${side}`} data-active={active || undefined}>
      {slot?.artUrl && (
        <img className="panel__art" src={slot.artUrl} alt="" />
      )}
      {status === 'empty' ? (
        <span className="panel__role">{role}</span>
      ) : (
        <>
          <div className="panel__scrim" />
          <div className="panel__text">
            <div className="panel__player">{playerName(side, index)}</div>
            <div className="panel__champ">{slot?.championName}</div>
            {status === 'hovering' && <div className="panel__hint">en cours de sélection</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Bans({ side, bans }: { side: Team; bans: BanSlot[] }) {
  return (
    <div className={`bans bans--${side}`}>
      <span className="bans__label">bans</span>
      <div className="bans__row">
        {[0, 1, 2, 3, 4].map((i) =>
          bans[i]?.iconUrl ? (
            <div className="ban" key={i}>
              <img src={bans[i].iconUrl!} alt={bans[i].championName ?? ''} />
              <span className="ban__slash" />
            </div>
          ) : (
            <div className="ban ban--empty" key={i} />
          ),
        )}
      </div>
    </div>
  );
}

export function DraftScene({ state }: { state: DraftState }) {
  const ms = useCountdown(state.timer.msLeft, state.timer.receivedAt);
  const seconds = Math.ceil(ms / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (!state.active) return <div className="scene scene--idle" />;

  const actor = state.current;
  const verb = actor?.type === 'ban' ? 'bannit un champion' : 'choisit son champion';

  return (
    <div className="scene">
      <header className="head">
        <div className="head__team head__team--blue">
          <span className="head__name">{TEAMS.blue.name}</span>
        </div>
        <div className="head__score">
          <span className="head__pts head__pts--blue">{TEAMS.blue.score}</span>
          <span className="head__dash">—</span>
          <span className="head__pts head__pts--red">{TEAMS.red.score}</span>
        </div>
        <div className="head__team head__team--red">
          <span className="head__name">{TEAMS.red.name}</span>
        </div>
      </header>

      <div className="stage">
        <div className="side side--blue">
          {ROLES.map((role, i) => (
            <Panel key={role} role={role} side="blue" index={i}
              slot={state.teams.blue.picks[i]}
              active={actor?.type === 'pick' && actor.team === 'blue' && actor.slotIndex === i} />
          ))}
        </div>

        {/* Bande centrale : largeur fixe, contenu qui ne bouge jamais.
            La fenetre camera est un trou reellement transparent, pour que
            la source video placee dessous dans OBS apparaisse au travers. */}
        <div className="band">
          <div className="band__pad" />
          <div className="band__camrow">
            <div className="band__gutter" />
            <div className="cam">
              <span className="cam__hint">caméra du caster</span>
            </div>
            <div className="band__gutter" />
          </div>
          <div className="band__info">
            <div className="center__clock">{clock}</div>
            <div className="center__track">
              <div className="center__fill" data-team={actor?.team}
                style={{ width: `${Math.min(100, (ms / 30000) * 100)}%` }} />
            </div>
            {actor && (
              <>
                <div className="center__actor" data-team={actor.team}>
                  {playerName(actor.team, actor.slotIndex)}
                </div>
                <div className="center__verb">{verb}</div>
              </>
            )}
          </div>
        </div>

        <div className="side side--red">
          {ROLES.map((role, i) => (
            <Panel key={role} role={role} side="red" index={i}
              slot={state.teams.red.picks[i]}
              active={actor?.type === 'pick' && actor.team === 'red' && actor.slotIndex === i} />
          ))}
        </div>
      </div>

      <footer className="foot">
        <Bans side="blue" bans={state.teams.blue.bans} />
        <Bans side="red" bans={state.teams.red.bans} />
      </footer>
    </div>
  );
}

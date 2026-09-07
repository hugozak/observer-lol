import { StrictMode, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DraftScene } from './DraftScene';
import { DevPanel } from './DevPanel';
import { useDraftState } from './useDraftState';
import type { DraftEvent } from './types';
import './scene.css';

const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const SCALE = Number(params.get('scale')) || 1;

function App() {
  // C'est ici que se branchent les animations. L'etat peint l'ecran,
  // l'evenement dit ce qui vient de changer. Avec GSAP :
  //   gsap.timeline().from(`.slot--${e.team}:nth-child(${e.slotIndex + 1})`, ...)
  const onEvent = useCallback((event: DraftEvent) => {
    if (event.type === 'pick.locked') {
      document
        .querySelector(`.side--${event.team} .panel:nth-child(${event.slotIndex + 1})`)
        ?.animate(
          [{ transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
          { duration: 320, easing: 'cubic-bezier(.2,.7,.3,1)' },
        );
    }
  }, []);

  const { state, connected, setState } = useDraftState(onEvent);

  useEffect(() => {
    // Le repere visuel de la fenetre camera n'apparait qu'en dev.
    if (DEV) document.body.dataset.dev = '';
  }, []);

  return (
    <>
      <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
        <DraftScene state={state} />
      </div>
      {DEV && <DevPanel onPick={setState} />}
      {DEV && !connected && (
        <div style={{ position: 'fixed', top: 8, right: 8, font: '12px system-ui', color: '#e0574b' }}>
          collecteur injoignable
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

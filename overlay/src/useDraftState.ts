import { useEffect, useRef, useState } from 'react';
import type { DraftState, DraftEvent } from './types';
import { EMPTY_STATE } from './types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:9001/api';

type Listener = (event: DraftEvent) => void;

/**
 * Connexion au collecteur. L'etat est la source de verite pour le rendu,
 * les evenements servent uniquement a declencher des animations.
 *
 * onEvent est garde dans une ref : sans ca, une fonction recreee a chaque
 * render relancerait le useEffect et donc la connexion WebSocket a chaque
 * message recu.
 */
export function useDraftState(onEvent?: Listener) {
  const [state, setState] = useState<DraftState>(EMPTY_STATE);
  const [connected, setConnected] = useState(false);
  const listener = useRef(onEvent);
  listener.current = onEvent;

  useEffect(() => {
    // En mode dev on peut piloter la scene a la main via le panneau,
    // sans collecteur qui tourne.
    if (new URLSearchParams(location.search).has('offline')) return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let alive = true;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);

      socket.onmessage = ({ data }) => {
        const msg = JSON.parse(data);
        if (msg.kind === 'state') setState(msg.state);
        if (msg.kind === 'events') msg.events.forEach((e: DraftEvent) => listener.current?.(e));
      };

      socket.onclose = () => {
        setConnected(false);
        // La Browser Source ne se recharge pas si le collecteur redemarre.
        if (alive) retry = setTimeout(connect, 1000);
      };
    };

    connect();
    return () => {
      alive = false;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return { state, connected, setState };
}

/**
 * Decompte local resynchronise a chaque message. Le collecteur n'envoie
 * pas un tick par seconde : il relaie ce que le client lui donne.
 */
export function useCountdown(msLeft: number, receivedAt: number) {
  const [ms, setMs] = useState(msLeft);

  useEffect(() => {
    const drift = Date.now() - receivedAt;
    const deadline = performance.now() + Math.max(0, msLeft - drift);

    const tick = () => setMs(Math.max(0, deadline - performance.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [msLeft, receivedAt]);

  return ms;
}

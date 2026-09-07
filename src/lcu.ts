import WebSocket from 'ws';
import { Agent } from 'undici';
import type { Credentials } from './lockfile.js';

/**
 * Le client League presente un certificat auto-signe. On desactive la
 * verification uniquement pour cet agent, pas globalement : on ne veut pas
 * d'un NODE_TLS_REJECT_UNAUTHORIZED=0 qui affaiblirait tout le process.
 */
const agent = new Agent({ connect: { rejectUnauthorized: false } });

function authHeader({ password }: Credentials): string {
  return 'Basic ' + Buffer.from(`riot:${password}`).toString('base64');
}

/** Requete REST sur le LCU. Renvoie null sur 404 (cas normal hors draft). */
export async function lcuGet<T>(creds: Credentials, path: string): Promise<T | null> {
  const res = await fetch(`https://127.0.0.1:${creds.port}${path}`, {
    headers: { Authorization: authHeader(creds) },
    // @ts-expect-error dispatcher est une extension undici du fetch standard
    dispatcher: agent,
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LCU ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export type LcuEvent = {
  eventType: 'Create' | 'Update' | 'Delete';
  uri: string;
  data: unknown;
};

type Handlers = {
  onEvent: (event: LcuEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Ouvre le WebSocket du LCU et s'abonne aux evenements de champ select.
 *
 * Le protocole est du WAMP : on envoie [5, "<nom de l'evenement>"] pour
 * s'abonner, et on recoit [8, "<nom>", { eventType, uri, data }].
 * Le sous-protocole "wamp" est obligatoire, sinon la connexion est refusee.
 */
export function connectLcuSocket(creds: Credentials, handlers: Handlers): WebSocket {
  const ws = new WebSocket(`wss://127.0.0.1:${creds.port}`, 'wamp', {
    rejectUnauthorized: false,
    headers: { Authorization: authHeader(creds) },
  });

  ws.on('open', () => {
    ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
    handlers.onOpen?.();
  });

  ws.on('message', (buf) => {
    const text = buf.toString();
    // Le LCU envoie des trames vides en guise de keepalive.
    if (!text) return;

    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (!Array.isArray(msg) || msg[0] !== 8) return;
    handlers.onEvent(msg[2] as LcuEvent);
  });

  ws.on('close', () => handlers.onClose?.());
  ws.on('error', () => {
    /* le close suit toujours, on gere la reconnexion la-bas */
  });

  return ws;
}

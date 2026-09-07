import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize as normalizePath } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { DraftState } from './normalize.js';
import type { DraftEvent } from './events.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export type Outbound =
  | { kind: 'state'; state: DraftState }
  | { kind: 'events'; events: DraftEvent[] };

export function startServer(port: number, publicDir: string, getState: () => DraftState) {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    // Empeche un ../.. de sortir du dossier public.
    const file = join(publicDir, normalizePath(rel).replace(/^(\.\.[/\\])+/, ''));

    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  const wss = new WebSocketServer({ server: http, path: '/api' });

  wss.on('connection', (socket) => {
    // Envoi immediat de l'etat courant. Indispensable : la Browser Source
    // OBS se reconnecte a chaque rafraichissement, souvent en plein milieu
    // d'une draft. Sans ca l'overlay repart d'un ecran vide.
    send(socket, { kind: 'state', state: getState() });
  });

  http.listen(port, () => {
    console.log(`  overlay   http://localhost:${port}`);
    console.log(`  websocket ws://localhost:${port}/api`);
  });

  return {
    broadcast(message: Outbound) {
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) send(client, message);
      }
    },
    clientCount: () => wss.clients.size,
  };
}

function send(socket: WebSocket, message: Outbound) {
  socket.send(JSON.stringify(message));
}

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Credentials = {
  port: number;
  password: string;
  protocol: string;
};

/**
 * Emplacements habituels du lockfile. Il est ecrit a la racine de
 * l'installation du client et supprime a sa fermeture.
 * Tu peux forcer un chemin avec la variable d'env LEAGUE_LOCKFILE.
 */
const DEFAULT_PATHS = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
  join(process.env.HOME ?? '', 'Applications', 'League of Legends.app', 'Contents', 'LoL', 'lockfile'),
];

function resolvePath(): string | null {
  const forced = process.env.LEAGUE_LOCKFILE;
  if (forced) return existsSync(forced) ? forced : null;
  return DEFAULT_PATHS.find((p) => existsSync(p)) ?? null;
}

/**
 * Format du fichier : nom:pid:port:password:protocol
 * Le port et le password changent a CHAQUE lancement du client.
 */
export async function readCredentials(): Promise<Credentials | null> {
  const path = resolvePath();
  if (!path) return null;

  try {
    const raw = await readFile(path, 'utf8');
    const parts = raw.trim().split(':');
    if (parts.length < 5) return null;

    const [, , port, password, protocol] = parts;
    return { port: Number(port), password, protocol };
  } catch {
    // Le client peut etre en train d'ecrire le fichier, on reessaiera.
    return null;
  }
}

/**
 * Attend que le client soit lance. On sonde le disque plutot que d'utiliser
 * fs.watch : sur Windows la surveillance de repertoire rate regulierement
 * la creation du fichier, et un poll de 2s est indolore.
 */
export async function waitForClient(intervalMs = 2000): Promise<Credentials> {
  for (;;) {
    const creds = await readCredentials();
    if (creds) return creds;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Le lockfile a-t-il disparu (client ferme) ? */
export function clientIsGone(): boolean {
  return resolvePath() === null;
}

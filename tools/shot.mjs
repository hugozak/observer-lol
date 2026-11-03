import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Playwright est installe globalement dans cet environnement, hors du
// node_modules du projet : la resolution ESM ne le voit pas, celle de
// require si. Sur ta machine un `npm i -D playwright` rend ce detour
// inutile et tu peux revenir a un import direct.
const { chromium } = createRequire(import.meta.url)('playwright');

/**
 * Capture la scene a 1920x1080, exactement comme OBS la rendra.
 *
 *   node tools/shot.mjs milieu-draft
 *
 * Les CDN de Riot ne sont pas joignables depuis cet environnement : les
 * requetes d'artwork sont interceptees et remplacees par un portrait
 * genere, au bon format (308x560). La composition est fidele, les
 * images sont des substituts.
 */

const fixture = process.argv[2] ?? 'milieu-draft';
// 9001 et pas un port libre au hasard : l'URL du WebSocket est figee
// dans le bundle a la compilation (VITE_WS_URL), donc l'overlay ne sait
// parler qu'a ce port. Le bac a sable doit s'y conformer.
const PORT = Number(process.env.PORT ?? 9001);
const OUT = join(process.cwd(), 'shots');

/** Portrait de substitution, teinte deterministe par identifiant. */
function portrait(label, seed, w, h) {
  const hue = (seed * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 45% 34%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 25) % 360} 50% 19%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360} 40% 9%)"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${w / 2}" cy="${h * 0.33}" r="${w * 0.26}" fill="hsl(${hue} 35% 55%)" opacity="0.5"/>
    <text x="50%" y="${h * 0.35}" text-anchor="middle" font-family="sans-serif"
      font-size="${Math.round(w * 0.1)}" fill="#fff" opacity="0.85">${label}</text>
    <text x="50%" y="${h * 0.95}" text-anchor="middle" font-family="sans-serif"
      font-size="${Math.round(w * 0.055)}" fill="#fff" opacity="0.35">substitut</text>
  </svg>`;
}

// detached : npx lance tsx dans un sous-processus, et tuer npx seul
// laisserait le serveur tenir le port. On tue tout le groupe a la fin.
// Le bac a sable doit tourner a cote :
//   npx tsx tools/sandbox.ts <fixture>
// On le verifie plutot que d'echouer sur un timeout obscur.
try {
  await fetch(`http://localhost:${PORT}/index.html`);
} catch {
  console.error(`Rien ne repond sur le port ${PORT}.`);
  console.error(`Lance d'abord :  npx tsx tools/sandbox.ts ${fixture}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

// Interception des deux CDN d'assets. Le nom du champion est deduit de
// l'URL pour que chaque portrait reste identifiable sur la capture.
await page.route(/ddragon\.leagueoflegends\.com|communitydragon\.org/, (route) => {
  const url = route.request().url();
  const art = url.match(/loading\/(\w+?)_0\.jpg/);
  const icon = url.match(/champion-icons\/(\d+)\.png/);
  const splash = url.match(/champion-splashes\/(\d+)\//);

  if (art) return route.fulfill({ contentType: 'image/svg+xml',
    body: portrait(art[1], [...art[1]].reduce((a, c) => a + c.charCodeAt(0), 0), 308, 560) });
  if (icon) return route.fulfill({ contentType: 'image/svg+xml',
    body: portrait('', Number(icon[1]), 120, 120) });
  if (splash) return route.fulfill({ contentType: 'image/svg+xml',
    body: portrait('', Number(splash[1]), 560, 308) });
  return route.fulfill({ status: 404, body: '' });
});

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));

await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
// Laisse les animations d'entree se poser avant la capture.
await page.waitForTimeout(1200);

// Quelques compteurs sur le DOM reellement rendu : une capture peut
// etre jolie et pourtant ne rien montrer de l'etat attendu.
/*
 * Mode --damier : on glisse un damier magenta DERRIERE la page. Tout ce
 * qui laisse voir le damier est un trou reellement transparent, donc une
 * zone ou la source video d'OBS apparaitra. Un rectangle noir sur une
 * capture ordinaire ne prouve rien : noir et transparent se ressemblent
 * sur un fond sombre, et on ne s'en apercoit qu'en direct.
 */
if (process.argv.includes('--damier')) {
  await page.addStyleTag({ content: `
    html { background-image:
      linear-gradient(45deg, #f0f 25%, transparent 25%, transparent 75%, #f0f 75%),
      linear-gradient(45deg, #f0f 25%, #111 25%, #111 75%, #f0f 75%);
      background-size: 48px 48px; background-position: 0 0, 24px 24px; }
    body { background: transparent !important; }
  ` });
  await page.waitForTimeout(300);
}

const shown = await page.evaluate(() => ({
  panneaux: document.querySelectorAll('.panel').length,
  verrouilles: document.querySelectorAll('.panel--locked').length,
  survols: document.querySelectorAll('.panel--hovering').length,
  bans: document.querySelectorAll('.ban:not(.ban--empty)').length,
  chrono: document.querySelector('.center__clock')?.textContent ?? '-',
}));
console.log(`  rendu     ${JSON.stringify(shown)}`);

const suffix = process.argv.includes('--damier') ? '-damier' : '';
const file = join(OUT, `${fixture}${suffix}.png`);
await page.screenshot({ path: file });
console.log(`\n  capture   ${file}`);
if (problems.length) console.log(`  erreurs console :\n    ${problems.join('\n    ')}`);

await browser.close();
// Sortie explicite : sans ca un descripteur restant garderait la boucle
// d'evenements en vie et le script ne rendrait jamais la main.
process.exit(problems.length ? 1 : 0);

/** Anteprima statica della mappa generata (solo per controllo visivo). */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(__dirname, '../src/game/world.data.ts'), 'utf8');
const body = raw.slice(raw.indexOf('= {') + 2, raw.lastIndexOf(';'));
const W = (0, eval)('(' + body + ')');
const vb = W.viewBox;

const colors = ['#C2452D', '#2E6DA4', '#2F8F5B', '#8E5AA8', '#D98A00', '#3F4A57'];
const regionIndex = Object.fromEntries(W.regions.map((r, i) => [r.id, i]));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="1600" height="${Math.round((1600 * vb.height) / vb.width)}">
<rect x="${vb.x}" y="${vb.y}" width="1600" height="${Math.round((1600 * vb.height) / vb.width)}" fill="#EDE4D3"/>
${W.landmasses.map((l) => `<path d="${l.path}" fill="none" stroke="#B9A88C" stroke-width="14" stroke-linejoin="round"/>`).join('\n')}
${W.territories.map((t) => `<path d="${t.path}" fill="${colors[regionIndex[t.region]]}" fill-opacity="0.5" stroke="#3B3229" stroke-width="2" stroke-linejoin="round"/>`).join('\n')}
${W.seaRoutes.map((r) => `<path d="M${r.a.x} ${r.a.y} Q ${(r.a.x + r.b.x) / 2} ${(r.a.y + r.b.y) / 2 - 60} ${r.b.x} ${r.b.y}" fill="none" stroke="#7A6A55" stroke-width="3" stroke-dasharray="10 12"/>`).join('\n')}
${W.territories.map((t) => `<circle cx="${t.center.x}" cy="${t.center.y}" r="18" fill="#fff" stroke="#3B3229" stroke-width="2"/><text x="${t.center.x}" y="${t.center.y + 34}" font-family="Georgia" font-size="19" text-anchor="middle" fill="#3B3229">${t.name}</text>`).join('\n')}
${W.regions.map((r) => `<text x="${r.label.x}" y="${r.label.y}" font-family="Georgia" font-size="42" letter-spacing="6" text-anchor="middle" fill="#8B7B63">${r.name.toUpperCase()}</text>`).join('\n')}
</svg>`;

const target = process.argv[2] || resolve(__dirname, '../map-preview.svg');
writeFileSync(target, svg);
console.log('scritto', target);

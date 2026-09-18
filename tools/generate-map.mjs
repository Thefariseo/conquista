/**
 * Generatore dell'atlante di Vhaldor.
 *
 * Trasforma le silhouette ASCII di tools/world.config.mjs in una mappa SVG
 * completa: contorni organici dei territori, confini, baricentri, adiacenze.
 * Il risultato viene scritto in src/game/world.data.ts ed è deterministico:
 * a parita' di configurazione, l'output è identico.
 *
 *   node tools/generate-map.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GRID, REGIONS, SEA_ROUTES } from './world.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = GRID.hexSize;
const APOTHEM = (SIZE * Math.sqrt(3)) / 2;
const COL_STEP = APOTHEM * 2;
const ROW_STEP = SIZE * 1.5;

const key = (x, y) => `${Math.round(x * 100)}:${Math.round(y * 100)}`;
const slug = (name) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

/** Hash deterministico stringa -> [0,1) */
function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

// --- reticolo esagonale (punta in alto, righe dispari sfalsate a destra) ---
const hexCenter = (col, row) => ({
  x: col * COL_STEP + (row % 2 ? APOTHEM : 0),
  y: row * ROW_STEP,
});

const CORNER_ANGLES = [0, 1, 2, 3, 4, 5].map((i) => ((60 * i - 30) * Math.PI) / 180);
const EDGE_ANGLES = [0, 1, 2, 3, 4, 5].map((i) => ((60 * i) * Math.PI) / 180);

const cornersOf = (c) =>
  CORNER_ANGLES.map((a) => ({ x: c.x + SIZE * Math.cos(a), y: c.y + SIZE * Math.sin(a) }));

/** centri dei 6 esagoni confinanti, in ordine coerente con gli spigoli */
const neighbourCenters = (c) =>
  EDGE_ANGLES.map((a) => ({
    x: c.x + 2 * APOTHEM * Math.cos(a),
    y: c.y + 2 * APOTHEM * Math.sin(a),
  }));

// --- 1. costruzione delle celle di terra ---------------------------------
const cells = new Map(); // key -> cell
for (const region of REGIONS) {
  region.art.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch !== '#') return;
      const col = region.origin.col + c;
      const row = region.origin.row + r;
      const center = hexCenter(col, row);
      const k = key(center.x, center.y);
      if (cells.has(k)) throw new Error(`Sovrapposizione fra regioni in ${col},${row}`);
      cells.set(k, { k, col, row, center, region: region.id, territory: null });
    });
  });
}

const neighboursOf = (cell) =>
  neighbourCenters(cell.center)
    .map((p) => cells.get(key(p.x, p.y)))
    .filter(Boolean);

// --- 2. partizione di ogni regione in territori --------------------------
/** distanza esagonale approssimata via coordinate cartesiane */
const dist = (a, b) => Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);

function pickSeeds(pool, count) {
  const sorted = [...pool].sort((a, b) => a.row - b.row || a.col - b.col);
  const seeds = [sorted[0]];
  while (seeds.length < count) {
    let best = null;
    let bestScore = -1;
    for (const cell of sorted) {
      if (seeds.includes(cell)) continue;
      const score = Math.min(...seeds.map((s) => dist(s, cell)));
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = cell;
      }
    }
    seeds.push(best);
  }
  return seeds;
}

const territories = [];

for (const region of REGIONS) {
  const pool = [...cells.values()].filter((c) => c.region === region.id);
  const count = region.territories.length;
  if (pool.length < count * 3) {
    throw new Error(`Regione ${region.id}: troppe poche celle (${pool.length}) per ${count} territori`);
  }
  const seeds = pickSeeds(pool, count);

  // crescita a turni: ogni territorio si espande di una cella per giro,
  // così le superfici restano equilibrate e sempre contigue.
  const groups = seeds.map((seed) => {
    seed.territory = seed;
    return { seed, cells: [seed], frontier: [seed] };
  });
  let placed = groups.length;
  let progress = true;
  while (placed < pool.length && progress) {
    progress = false;
    // il gruppo più piccolo sceglie per primo
    const order = [...groups].sort((a, b) => a.cells.length - b.cells.length);
    for (const g of order) {
      let chosen = null;
      let chosenScore = Infinity;
      for (const f of g.frontier) {
        for (const n of neighboursOf(f)) {
          if (n.territory || n.region !== region.id) continue;
          const score = dist(g.seed, n) + hash01(n.k, 7) * 4;
          if (score < chosenScore) {
            chosenScore = score;
            chosen = n;
          }
        }
      }
      if (!chosen) continue;
      chosen.territory = g.seed;
      g.cells.push(chosen);
      g.frontier.push(chosen);
      placed++;
      progress = true;
    }
  }
  // eventuali sacche isolate: al territorio confinante più piccolo
  let orphans = pool.filter((c) => !c.territory);
  let guard = 0;
  while (orphans.length && guard++ < 200) {
    for (const cell of orphans) {
      const adj = neighboursOf(cell).filter((n) => n.territory);
      if (!adj.length) continue;
      const target = adj
        .map((n) => groups.find((g) => g.seed === n.territory))
        .sort((a, b) => a.cells.length - b.cells.length)[0];
      cell.territory = target.seed;
      target.cells.push(cell);
    }
    orphans = pool.filter((c) => !c.territory);
  }

  // nomi assegnati in ordine di lettura (nord -> sud, ovest -> est)
  const ordered = [...groups].sort((a, b) => {
    const ca = centroid(a.cells);
    const cb = centroid(b.cells);
    return ca.y - cb.y || ca.x - cb.x;
  });
  ordered.forEach((g, i) => {
    const name = region.territories[i];
    territories.push({
      id: slug(name),
      name,
      region: region.id,
      cells: g.cells,
    });
    g.cells.forEach((c) => (c.territoryId = slug(name)));
  });
}

function centroid(list) {
  const x = list.reduce((s, c) => s + c.center.x, 0) / list.length;
  const y = list.reduce((s, c) => s + c.center.y, 0) / list.length;
  return { x, y };
}

// --- 3. contorni organici ------------------------------------------------
const jitterCache = new Map();
function jitter(p) {
  const k = key(p.x, p.y);
  let v = jitterCache.get(k);
  if (!v) {
    const a = hash01(k, 11) * Math.PI * 2;
    const r = (0.45 + hash01(k, 23) * 0.55) * GRID.jitter * SIZE;
    v = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
    jitterCache.set(k, v);
  }
  return v;
}

/** contorno (uno o più anelli) dell'unione di un insieme di celle */
function outline(cellList) {
  const inside = new Set(cellList.map((c) => c.k));
  const edges = new Map(); // fromKey -> [toPoint]
  const points = new Map(); // key -> punto deformato

  for (const cell of cellList) {
    const corners = cornersOf(cell.center).map(jitter);
    const nb = neighbourCenters(cell.center);
    for (let i = 0; i < 6; i++) {
      if (inside.has(key(nb[i].x, nb[i].y))) continue;
      const a = corners[i];
      const b = corners[(i + 1) % 6];
      const ka = key(a.x, a.y);
      const kb = key(b.x, b.y);
      points.set(ka, a);
      points.set(kb, b);
      if (!edges.has(ka)) edges.set(ka, []);
      edges.get(ka).push(kb);
    }
  }

  const rings = [];
  while (edges.size) {
    const startKey = edges.keys().next().value;
    const ring = [];
    let cur = startKey;
    let guard = 0;
    while (guard++ < 10000) {
      const outs = edges.get(cur);
      if (!outs || !outs.length) break;
      const next = outs.shift();
      if (!outs.length) edges.delete(cur);
      ring.push(points.get(cur));
      cur = next;
      if (cur === startKey) break;
    }
    if (ring.length > 2) rings.push(ring);
  }
  rings.sort((a, b) => b.length - a.length);
  return rings;
}

const fmt = (n) => Math.round(n * 10) / 10;
const ringsToPath = (rings) =>
  rings
    .map((r) => `M${r.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join('L')}Z`)
    .join('');

// --- 4. adiacenze --------------------------------------------------------
const adjacency = new Map(territories.map((t) => [t.id, new Set()]));
for (const cell of cells.values()) {
  for (const n of neighboursOf(cell)) {
    if (n.territoryId !== cell.territoryId) {
      adjacency.get(cell.territoryId).add(n.territoryId);
      adjacency.get(n.territoryId).add(cell.territoryId);
    }
  }
}
for (const [a, b] of SEA_ROUTES) {
  if (!adjacency.has(a) || !adjacency.has(b)) throw new Error(`Rotta marittima ignota: ${a} <-> ${b}`);
  adjacency.get(a).add(b);
  adjacency.get(b).add(a);
}

// --- 5. geometria finale -------------------------------------------------
const out = { regions: [], territories: [], landmasses: [], seaRoutes: [] };

for (const t of territories) {
  const rings = outline(t.cells);
  const avg = centroid(t.cells);
  // ancora del segnalino: centro dell'esagono più vicino al baricentro
  // (garantisce che il token resti dentro anche con forme concave)
  const anchorCell = t.cells.reduce((best, c) =>
    Math.hypot(c.center.x - avg.x, c.center.y - avg.y) <
    Math.hypot(best.center.x - avg.x, best.center.y - avg.y)
      ? c
      : best,
  );
  out.territories.push({
    id: t.id,
    name: t.name,
    region: t.region,
    size: t.cells.length,
    path: ringsToPath(rings),
    center: { x: fmt(anchorCell.center.x), y: fmt(anchorCell.center.y) },
    neighbours: [...adjacency.get(t.id)].sort(),
  });
}

for (const region of REGIONS) {
  const regionCells = [...cells.values()].filter((c) => c.region === region.id);
  const xs = regionCells.map((c) => c.center.x);
  const ys = regionCells.map((c) => c.center.y);
  out.landmasses.push({ id: region.id, path: ringsToPath(outline(regionCells)) });
  out.regions.push({
    id: region.id,
    name: region.name,
    bonus: region.bonus,
    accent: region.accent,
    territories: territories.filter((t) => t.region === region.id).map((t) => t.id),
    label: {
      x: fmt((Math.min(...xs) + Math.max(...xs)) / 2),
      y: fmt(Math.min(...ys) - SIZE * 2.4),
    },
  });
}

const byId = new Map(out.territories.map((t) => [t.id, t]));
out.seaRoutes = SEA_ROUTES.map(([a, b]) => ({
  from: a,
  to: b,
  a: byId.get(a).center,
  b: byId.get(b).center,
}));

const allX = [...cells.values()].flatMap((c) => [c.center.x - SIZE, c.center.x + SIZE]);
const allY = [...cells.values()].flatMap((c) => [c.center.y - SIZE, c.center.y + SIZE]);
const minX = Math.min(...allX) - GRID.margin;
const minY = Math.min(...allY) - GRID.margin;
const maxX = Math.max(...allX) + GRID.margin;
const maxY = Math.max(...allY) + GRID.margin;
out.viewBox = { x: fmt(minX), y: fmt(minY), width: fmt(maxX - minX), height: fmt(maxY - minY) };

// --- 6. verifiche --------------------------------------------------------
const problems = [];
if (new Set(out.territories.map((t) => t.id)).size !== out.territories.length)
  problems.push('ID territori duplicati');
for (const t of out.territories) {
  if (!t.neighbours.length) problems.push(`${t.id} non ha confini`);
  for (const n of t.neighbours) {
    if (!byId.has(n)) problems.push(`${t.id} confina con ${n} inesistente`);
    else if (!byId.get(n).neighbours.includes(t.id)) problems.push(`adiacenza non simmetrica ${t.id}/${n}`);
  }
}
// connettivita' globale
const seen = new Set([out.territories[0].id]);
const queue = [out.territories[0].id];
while (queue.length) {
  for (const n of byId.get(queue.pop()).neighbours) {
    if (!seen.has(n)) {
      seen.add(n);
      queue.push(n);
    }
  }
}
if (seen.size !== out.territories.length) problems.push(`mappa non connessa (${seen.size}/${out.territories.length})`);
if (problems.length) {
  console.error('PROBLEMI:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// --- 7. scrittura --------------------------------------------------------
const header = `// FILE GENERATO — non modificare a mano.
// Sorgente: tools/world.config.mjs + tools/generate-map.mjs
// Rigenera con:  npm run genmap
import type { WorldMap } from './world';

export const WORLD_DATA: WorldMap = `;

writeFileSync(
  resolve(__dirname, '../src/game/world.data.ts'),
  header +
    JSON.stringify(out)
      .replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, '$1: ')
      .replace(/\},\{/g, '},\n  {')
      .replace(/\],/g, '],\n ')
      .replace(/^\{/, '{\n ') +
    ';\n',
);

console.log(`Territori: ${out.territories.length}  Regioni: ${out.regions.length}`);
for (const r of out.regions) {
  const ts = out.territories.filter((t) => t.region === r.id);
  console.log(
    `  ${r.name.padEnd(10)} bonus ${r.bonus}  ${ts.length} territori  ` +
      `(celle ${Math.min(...ts.map((t) => t.size))}-${Math.max(...ts.map((t) => t.size))})`,
  );
}
const degrees = out.territories.map((t) => t.neighbours.length);
console.log(`Confini per territorio: min ${Math.min(...degrees)} max ${Math.max(...degrees)} medio ${(degrees.reduce((a, b) => a + b, 0) / degrees.length).toFixed(1)}`);
console.log(`viewBox ${out.viewBox.width} x ${out.viewBox.height}`);

/**
 * Generatore pseudo-casuale deterministico.
 *
 * Lo stato del generatore fa parte dello stato di gioco: due client che
 * applicano la stessa sequenza di azioni ottengono gli stessi dadi. È il
 * requisito per il replay, per i test e per un futuro server autoritativo.
 */
export interface RngState {
  seed: number;
  /** quante estrazioni sono già avvenute */
  cursor: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, cursor: 0 };
}

/** mulberry32: veloce, stabile fra piattaforme, periodo più che sufficiente */
function sample(seed: number, cursor: number): number {
  let t = (seed + cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** estrae un float in [0,1) e restituisce il nuovo stato */
export function nextFloat(rng: RngState): [number, RngState] {
  const value = sample(rng.seed, rng.cursor + 1);
  return [value, { seed: rng.seed, cursor: rng.cursor + 1 }];
}

/** estrae un intero in [0, max) */
export function nextInt(rng: RngState, max: number): [number, RngState] {
  const [v, next] = nextFloat(rng);
  return [Math.floor(v * max), next];
}

/** lancia `count` dadi a 6 facce, già ordinati dal più alto al più basso */
export function rollDice(rng: RngState, count: number): [number[], RngState] {
  const dice: number[] = [];
  let state = rng;
  for (let i = 0; i < count; i++) {
    const [v, next] = nextInt(state, 6);
    dice.push(v + 1);
    state = next;
  }
  dice.sort((a, b) => b - a);
  return [dice, state];
}

/** mescolamento Fisher-Yates deterministico (non muta l'array in ingresso) */
export function shuffle<T>(rng: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, i + 1);
    state = next;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, state];
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

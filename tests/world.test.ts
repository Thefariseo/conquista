import { describe, expect, it } from 'vitest';
import { REGIONS, TERRITORIES, TERRITORY_COUNT, territory } from '../src/game/world';

describe('atlante di Vhaldor', () => {
  it('ha fra 35 e 50 territori distribuiti in 5-7 macro-regioni', () => {
    expect(TERRITORY_COUNT).toBeGreaterThanOrEqual(35);
    expect(TERRITORY_COUNT).toBeLessThanOrEqual(50);
    expect(REGIONS.length).toBeGreaterThanOrEqual(5);
    expect(REGIONS.length).toBeLessThanOrEqual(7);
  });

  it('assegna ogni territorio a una sola macro-regione', () => {
    const fromRegions = REGIONS.flatMap((r) => r.territories);
    expect(new Set(fromRegions).size).toBe(TERRITORY_COUNT);
    for (const t of TERRITORIES) {
      expect(REGIONS.find((r) => r.id === t.region)?.territories).toContain(t.id);
    }
  });

  it('ha confini simmetrici e mai vuoti', () => {
    for (const t of TERRITORIES) {
      expect(t.neighbours.length).toBeGreaterThan(0);
      expect(t.neighbours).not.toContain(t.id);
      for (const n of t.neighbours) {
        expect(territory(n).neighbours).toContain(t.id);
      }
    }
  });

  it('forma un grafo connesso: ogni territorio e’ raggiungibile', () => {
    const seen = new Set([TERRITORIES[0].id]);
    const queue = [TERRITORIES[0].id];
    while (queue.length) {
      for (const n of territory(queue.pop()!).neighbours) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(TERRITORY_COUNT);
  });

  it('ha contorni e ancore valide per il disegno', () => {
    for (const t of TERRITORIES) {
      expect(t.path.startsWith('M')).toBe(true);
      expect(Number.isFinite(t.center.x)).toBe(true);
      expect(Number.isFinite(t.center.y)).toBe(true);
    }
  });

  it('usa nomi originali e unici', () => {
    const names = TERRITORIES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

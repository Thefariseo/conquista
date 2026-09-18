import { describe, expect, it } from 'vitest';
import { compareDice, conquestProbability, maxAttackDice, maxDefenceDice, resolveRoll } from '../src/game/combat';
import { createRng } from '../src/game/rng';

describe('scontro', () => {
  it('assegna la parita’ al difensore', () => {
    expect(compareDice([4], [4])).toEqual({ attackerLosses: 1, defenderLosses: 0 });
    expect(compareDice([5], [4])).toEqual({ attackerLosses: 0, defenderLosses: 1 });
    expect(compareDice([6, 5], [6, 4])).toEqual({ attackerLosses: 1, defenderLosses: 1 });
    expect(compareDice([6, 5, 2], [1, 1])).toEqual({ attackerLosses: 0, defenderLosses: 2 });
  });

  it('limita i dadi alle armate disponibili', () => {
    expect(maxAttackDice(1)).toBe(0);
    expect(maxAttackDice(2)).toBe(1);
    expect(maxAttackDice(4)).toBe(3);
    expect(maxAttackDice(10)).toBe(3);
    expect(maxDefenceDice(1)).toBe(1);
    expect(maxDefenceDice(5)).toBe(2);
  });

  it('calcola probabilita’ coerenti e monotone', () => {
    expect(conquestProbability(1, 1)).toBe(0);
    expect(conquestProbability(2, 1)).toBeGreaterThan(0.4);
    expect(conquestProbability(2, 1)).toBeLessThan(0.5);
    expect(conquestProbability(10, 1)).toBeGreaterThan(0.99);
    for (let d = 1; d <= 8; d++) {
      for (let a = 2; a <= 14; a++) {
        expect(conquestProbability(a + 1, d)).toBeGreaterThanOrEqual(conquestProbability(a, d) - 1e-9);
        expect(conquestProbability(a, d + 1)).toBeLessThanOrEqual(conquestProbability(a, d) + 1e-9);
      }
    }
  });

  it('e’ deterministico a parita’ di seme', () => {
    const a = resolveRoll(createRng(42), 3, 2, 5);
    const b = resolveRoll(createRng(42), 3, 2, 5);
    expect(a[0]).toEqual(b[0]);
    expect(a[0].attack).toHaveLength(3);
    expect(a[0].defence).toHaveLength(2);
    expect(a[0].attackerLosses + a[0].defenderLosses).toBe(2);
  });
});

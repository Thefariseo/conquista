/** Salvataggio locale della partita in corso, per riprenderla dopo un refresh. */
import type { GameState } from '../game/types';
import { STATE_VERSION } from '../game/reducer';

const KEY = 'conquista:partita';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // spazio esaurito o navigazione privata: la partita resta comunque giocabile
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as GameState;
    if (state.version !== STATE_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorato */
  }
}

const PREFS = 'conquista:preferenze';

export interface Preferences {
  tutorialVisto: boolean;
  animazioni: boolean;
  simboli: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { tutorialVisto: false, animazioni: true, simboli: true };

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS);
    return raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    /* ignorato */
  }
}

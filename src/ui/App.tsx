/** Punto di ingresso dell'interfaccia: menu, partita, preferenze. */
import { useCallback, useMemo, useState } from 'react';
import { SetupScreen, type SetupChoice } from './SetupScreen';
import { GameScreen } from './GameScreen';
import { RulesPanel } from './Overlays';
import { useGame } from './useGame';
import { applyAction, createGame } from '../game/reducer';
import type { GameState } from '../game/types';
import { randomSeed } from '../game/rng';
import { clearGame, loadGame, loadPreferences, savePreferences, saveGame, type Preferences } from '../net/storage';
import { currentPlayerId } from '../game/selectors';

export function App() {
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());
  const [game, setGame] = useState<GameState | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());

  const updatePrefs = useCallback((next: Preferences) => {
    setPrefs(next);
    savePreferences(next);
  }, []);

  const start = useCallback((choice: SetupChoice) => {
    let state = createGame({
      players: choice.players,
      victoryMode: choice.victoryMode,
      autoDistribute: choice.autoDistribute,
      showOdds: choice.showOdds,
      seed: randomSeed(),
    });
    if (choice.autoDistribute) {
      // il tavolo si apre già schierato: si comincia subito a giocare
      let guard = 0;
      while (state.phase === 'schieramento' && guard++ < 200) {
        const result = applyAction(state, { type: 'schieramento/auto', player: currentPlayerId(state) });
        if (!result.ok) break;
        state = result.state;
      }
    }
    saveGame(state);
    setSaved(state);
    setGame(state);
  }, []);

  // uscire dal tavolo non butta via la partita: resta ripescabile dal menu
  const exit = useCallback(() => {
    setSaved(loadGame());
    setGame(null);
  }, []);

  const newGame = useCallback(() => {
    clearGame();
    setSaved(null);
    setGame(null);
  }, []);

  if (!game) {
    return (
      <>
        <SetupScreen
          onStart={start}
          hasSave={Boolean(saved)}
          onResume={() => saved && setGame(saved)}
          onRules={() => setRulesOpen(true)}
        />
        <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </>
    );
  }

  return <Table initial={game} prefs={prefs} onPrefs={updatePrefs} onExit={exit} onNewGame={newGame} />;
}

function Table({
  initial,
  prefs,
  onPrefs,
  onExit,
  onNewGame,
}: {
  initial: GameState;
  prefs: Preferences;
  onPrefs(prefs: Preferences): void;
  onExit(): void;
  onNewGame(): void;
}) {
  const controlled = useMemo(
    () => initial.players.filter((p) => p.kind === 'umano').map((p) => p.id),
    [initial],
  );
  const api = useGame(initial, controlled);
  return <GameScreen api={api} prefs={prefs} onPrefs={onPrefs} onExit={onExit} onNewGame={onNewGame} />;
}

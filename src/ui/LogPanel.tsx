/** Cronologia delle azioni: il diario della partita. */
import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types';
import { describeEvent } from '../game/log';
import { Icona } from './Icons';
import { Stemma } from './PlayerBoard';

export function LogPanel({ state, open, onClose }: { state: GameState; open: boolean; onClose(): void }) {
  const lista = useRef<HTMLOListElement>(null);
  // si scorre solo la lista: scrollIntoView trascinerebbe con se' l'intero tavolo
  useEffect(() => {
    if (open && lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [open, state.log.length]);

  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Ignoto';

  return (
    <aside className={`cronologia${open ? ' cronologia--aperta' : ''}`} aria-hidden={!open}>
      <header className="cronologia__testa">
        <h2>Cronologia</h2>
        <button type="button" className="bottone-icona" onClick={onClose} aria-label="Chiudi la cronologia">
          <Icona nome="chiudi" />
        </button>
      </header>
      <ol className="cronologia__lista" ref={lista}>
        {state.log.map((entry) => {
          const line = describeEvent(entry.event, nameOf);
          if (!line.text) return null;
          const seat = state.players.find((p) => p.id === entry.player)?.seat;
          return (
            <li key={entry.id} className={`cronologia__voce cronologia__voce--${line.tone}`}>
              <span className="cronologia__segno">
                {seat === undefined ? <Icona nome={line.icon} size={14} /> : <Stemma seat={seat} size={14} />}
              </span>
              <span className="cronologia__testo">{line.text}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** La plancia in basso: i posti al tavolo, la fase e il comando principale. */
import { useEffect, useRef } from 'react';
import type { GameState, Phase, PlayerId } from '../game/types';
import { SEATS, symbolPath } from './palette';
import { armiesOf, territoryCount } from '../game/selectors';
import { Icona } from './Icons';

const FASI: { id: Phase; nome: string; icona: string }[] = [
  { id: 'rinforzo', nome: 'Rinforzo', icona: 'rinforzo' },
  { id: 'attacco', nome: 'Attacco', icona: 'attacco' },
  { id: 'spostamento', nome: 'Spostamento', icona: 'spostamento' },
];

export function Stemma({ seat, size = 18 }: { seat: number; size?: number }) {
  const s = SEATS[seat];
  return (
    <svg className="stemma" width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <circle r="9.4" fill={s.color} />
      <path d={symbolPath(s.symbol, 5)} fill={s.ink} />
    </svg>
  );
}

export function PhaseTrack({ phase }: { phase: Phase }) {
  if (phase === 'schieramento' || phase === 'conclusa') {
    return (
      <ol className="fasi" aria-label="Fase del turno">
        <li className="fasi__voce fasi__voce--attiva">
          <Icona nome="armata" size={15} />
          <span>{phase === 'schieramento' ? 'Schieramento iniziale' : 'Partita conclusa'}</span>
        </li>
      </ol>
    );
  }
  const index = FASI.findIndex((f) => f.id === phase);
  return (
    <ol className="fasi" aria-label="Fase del turno">
      {FASI.map((f, i) => (
        <li
          key={f.id}
          className={`fasi__voce${i === index ? ' fasi__voce--attiva' : ''}${i < index ? ' fasi__voce--fatta' : ''}`}
          aria-current={i === index ? 'step' : undefined}
        >
          <Icona nome={f.icona} size={15} />
          <span>{f.nome}</span>
        </li>
      ))}
    </ol>
  );
}

export function Seats({
  state,
  controlled,
  onInspect,
}: {
  state: GameState;
  controlled: PlayerId[];
  onInspect?(id: PlayerId): void;
}) {
  const current = state.order[state.currentIndex];
  const lista = useRef<HTMLUListElement>(null);

  // quando la striscia dei posti non ci sta, si porta in vista quello di turno
  useEffect(() => {
    const ul = lista.current;
    if (!ul) return;
    const attivo = ul.querySelector<HTMLElement>('.seggio--attivo');
    if (!attivo || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollLeft = attivo.offsetLeft - (ul.clientWidth - attivo.offsetWidth) / 2;
  }, [current, state.players.length]);

  return (
    <ul className="seggi" ref={lista}>
      {state.players.map((p) => {
        const seat = SEATS[p.seat];
        const active = p.id === current && state.phase !== 'conclusa';
        return (
          <li
            key={p.id}
            className={`seggio${active ? ' seggio--attivo' : ''}${p.alive ? '' : ' seggio--fuori'}`}
            style={{ ['--tinta' as string]: seat.color }}
          >
            <button type="button" className="seggio__corpo" onClick={() => onInspect?.(p.id)}>
              <Stemma seat={p.seat} size={22} />
              <span className="seggio__nome">
                {p.name}
                {controlled.includes(p.id) && <em className="seggio__tu">tu</em>}
              </span>
              <span className="seggio__dati">
                <span title="Territori">
                  <Icona nome="bandiera" size={13} /> {territoryCount(state, p.id)}
                </span>
                <span title="Armate">
                  <Icona nome="armata" size={13} /> {armiesOf(state, p.id)}
                </span>
                <span title="Carte">
                  <Icona nome="carte" size={13} /> {p.cards.length}
                </span>
              </span>
              {p.kind === 'bot' && <span className="seggio__natura">bot · {p.botLevel}</span>}
              {!p.alive && <span className="seggio__natura">fuori gioco</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

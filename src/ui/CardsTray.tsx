/** Il ventaglio delle carte conquista, come un mazzetto tenuto in mano. */
import { useEffect, useState } from 'react';
import type { Card, GameState, PlayerId } from '../game/types';
import { SYMBOL_LABEL, SYMBOL_VALUE, MIXED_VALUE, WILD_VALUE, bestSet, findSets, setValue, HAND_LIMIT } from '../game/cards';
import { handOf } from '../game/selectors';
import { territoryName } from '../game/world';
import { symbolPath } from './palette';
import { Icona } from './Icons';

const SYMBOL_MARK: Record<string, 'rombo' | 'triangolo' | 'esagono' | 'stella'> = {
  vessillo: 'rombo',
  ariete: 'triangolo',
  falco: 'esagono',
  sigillo: 'stella',
};

export function CardsTray({
  state,
  player,
  open,
  canPlay,
  onPlay,
  onClose,
}: {
  state: GameState;
  player: PlayerId;
  open: boolean;
  canPlay: boolean;
  onPlay(cards: [string, string, string]): void;
  onClose(): void;
}) {
  const hand = handOf(state, player);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected([]), [player, hand.length, open]);

  const sets = findSets(hand);
  const scelte = hand.filter((c) => selected.includes(c.id));
  const valid = selected.length === 3 && sets.some((s) => s.every((c) => selected.includes(c.id)));
  const value = valid ? setValue(scelte) : 0;
  const migliore = bestSet(hand);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : cur.length < 3 ? [...cur, id] : cur));

  return (
    <section className={`mazzo${open ? ' mazzo--aperto' : ''}`} aria-hidden={!open} aria-label="Le tue carte conquista">
      <header className="mazzo__testa">
        <h2>
          Carte conquista <span className="mazzo__conteggio">{hand.length}</span>
        </h2>
        <p>
          Tre vessilli <strong>{SYMBOL_VALUE.vessillo}</strong>, tre arieti <strong>{SYMBOL_VALUE.ariete}</strong>, tre
          falchi <strong>{SYMBOL_VALUE.falco}</strong>, uno di ogni simbolo <strong>{MIXED_VALUE}</strong>, sigillo più
          due uguali <strong>{WILD_VALUE}</strong>. Con {HAND_LIMIT} carte in mano sei obbligato a giocare una
          combinazione.
        </p>
        <button type="button" className="bottone-icona" onClick={onClose} aria-label="Chiudi le carte">
          <Icona nome="chiudi" />
        </button>
      </header>

      <div className="mazzo__ventaglio">
        {hand.map((c) => (
          <CardFace key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
        {!hand.length && <p className="mazzo__vuoto">Nessuna carta: se ne riceve una per ogni turno in cui conquisti almeno un territorio.</p>}
      </div>

      <div className="mazzo__comandi">
        <button
          type="button"
          className="bottone bottone--fantasma"
          disabled={!migliore}
          onClick={() => migliore && setSelected(migliore.map((c) => c.id))}
        >
          Trova la combinazione migliore
        </button>
        <button
          type="button"
          className="bottone bottone--primario"
          disabled={!valid || !canPlay}
          onClick={() => valid && onPlay(selected as [string, string, string])}
        >
          {valid ? `Gioca per ${value} armate` : 'Scegli tre carte'}
        </button>
      </div>
    </section>
  );
}

function CardFace({ card, selected, onClick }: { card: Card; selected: boolean; onClick(): void }) {
  const mark = SYMBOL_MARK[card.symbol] ?? 'rombo';
  return (
    <button
      type="button"
      className={`carta${selected ? ' carta--scelta' : ''}${card.symbol === 'sigillo' ? ' carta--jolly' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <svg className="carta__simbolo" viewBox="-12 -12 24 24" aria-hidden="true">
        <path d={symbolPath(mark, 9)} />
      </svg>
      <span className="carta__simbolo-nome">{SYMBOL_LABEL[card.symbol]}</span>
      <span className="carta__territorio">{card.territory ? territoryName(card.territory) : 'jolly'}</span>
    </button>
  );
}

/** Dadi disegnati come oggetti fisici: facce, pallini, ombra. */
import { memo } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export type DiceTone = 'attacco' | 'difesa';

export const Die = memo(function Die({
  value,
  tone,
  outcome,
  rolling,
  indice = 0,
  size = 46,
}: {
  value: number;
  tone: DiceTone;
  /** esito del confronto con il dado avversario */
  outcome?: 'vinto' | 'perso' | null;
  rolling?: boolean;
  /** posizione nella fila: sfalsa il lancio, cosi' i dadi non si muovono all'unisono */
  indice?: number;
  size?: number;
}) {
  const offset = size * 0.24;
  return (
    <span
      className={`dado dado--${tone}${rolling ? ' dado--lancio' : ''}${outcome ? ` dado--${outcome}` : ''}`}
      style={{ width: size, height: size, animationDelay: rolling ? `${indice * 70}ms` : undefined }}
      aria-hidden="true"
    >
      <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} width={size} height={size}>
        <rect
          className="dado__corpo"
          x={-size / 2 + 2}
          y={-size / 2 + 2}
          width={size - 4}
          height={size - 4}
          rx={size * 0.22}
        />
        {(PIPS[value] ?? []).map(([x, y], i) => (
          <circle key={i} className="dado__pallino" cx={x * offset} cy={y * offset} r={size * 0.085} />
        ))}
      </svg>
    </span>
  );
});

export function DiceRow({
  values,
  tone,
  outcomes,
  rolling,
  label,
}: {
  values: number[];
  tone: DiceTone;
  outcomes?: ('vinto' | 'perso' | null)[];
  rolling?: boolean;
  label: string;
}) {
  return (
    <div className={`dadi dadi--${tone}`}>
      <span className="dadi__etichetta">{label}</span>
      <div className="dadi__fila">
        {values.map((v, i) => (
          <Die key={i} value={v} tone={tone} outcome={outcomes?.[i] ?? null} rolling={rolling} indice={i} />
        ))}
        {!values.length && <span className="dadi__vuoto">—</span>}
      </div>
    </div>
  );
}

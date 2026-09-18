/**
 * Il tavolo di gioco.
 *
 * Tutta la mappa è un solo SVG: nessuna griglia, nessuna lista di
 * territori. Si gioca toccando la carta.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { WORLD, type TerritoryId, territory } from '../game/world';
import type { GameState } from '../game/types';
import { SEATS, symbolPath } from './palette';

export type TerritoryMood = 'normale' | 'selezionabile' | 'selezionato' | 'bersaglio' | 'collegato' | 'spento';

export interface MapViewProps {
  state: GameState;
  moods: Record<TerritoryId, TerritoryMood>;
  onPick(id: TerritoryId, event: { shift: boolean; alt: boolean }): void;
  /** freccia dell'azione in corso (attacco o spostamento) */
  arrow?: { from: TerritoryId; to: TerritoryId; tone: 'attacco' | 'spostamento' } | null;
  /** territori da far pulsare dopo un evento */
  flash?: TerritoryId[];
  /** perdite da mostrare sulla carta, come gettoni tolti dal tavolo */
  damage?: { id: number; territory: TerritoryId; amount: number }[];
  showPatterns: boolean;
  animate: boolean;
}

const TOKEN_R = 22;

interface Viewport {
  k: number;
  x: number;
  y: number;
}

const FIT: Viewport = { k: 1, x: 0, y: 0 };

export const MapView = memo(function MapView({
  state,
  moods,
  onPick,
  arrow,
  flash = [],
  damage = [],
  showPatterns,
  animate,
}: MapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<Viewport>(FIT);
  const drag = useRef<{ x: number; y: number; moved: number; pointer: number } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());

  const vb = WORLD.viewBox;

  const clamp = useCallback((v: Viewport): Viewport => {
    const k = Math.min(6, Math.max(0.75, v.k));
    const span = { x: vb.width * (k - 1), y: vb.height * (k - 1) };
    return {
      k,
      x: Math.min(span.x * 0.5 + vb.width * 0.15, Math.max(-span.x - vb.width * 0.15, v.x)),
      y: Math.min(span.y * 0.5 + vb.height * 0.15, Math.max(-span.y - vb.height * 0.15, v.y)),
    };
  }, [vb.height, vb.width]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(vb.width / rect.width, vb.height / rect.height);
    return {
      x: vb.x + (clientX - rect.left - rect.width / 2) * scale + vb.width / 2,
      y: vb.y + (clientY - rect.top - rect.height / 2) * scale + vb.height / 2,
    };
  }, [vb]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const point = toLocal(e.clientX, e.clientY);
      setView((v) => {
        const k = v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
        const factor = k / v.k;
        return clamp({
          k,
          x: point.x - (point.x - v.x) * factor,
          y: point.y - (point.y - v.y) * factor,
        });
      });
    },
    [clamp, toLocal],
  );

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const handler = (e: Event) => e.preventDefault();
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, []);

  // su schermi stretti e alti la carta intera resterebbe minuscola:
  // si parte gia' avvicinati, lasciando al giocatore lo zoom per il colpo d'occhio
  const adattato = useRef(false);
  useEffect(() => {
    const node = svgRef.current;
    if (!node || adattato.current) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    adattato.current = true;
    const rapporto = vb.width / vb.height / (rect.width / rect.height);
    if (rapporto <= 1.2) return;
    const k = Math.min(rapporto, 2.6);
    // lo zoom avviene attorno all'origine: si compensa per tenere fermo
    // il centro della carta
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    setView(() => clamp({ k, x: cx * (1 - k), y: cy * (1 - k) }));
  }, [clamp, vb.height, vb.width]);

  const onPointerDown = (e: React.PointerEvent) => {
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, moved: 0, pointer: e.pointerId };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pinch.current.has(e.pointerId)) return;
    const previous = pinch.current.get(e.pointerId)!;
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current.size >= 2) {
      const [a, b] = [...pinch.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const last = (pinch.current as unknown as { lastDistance?: number }).lastDistance;
      if (last) {
        const centre = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
        setView((v) => {
          const k = v.k * (distance / last);
          const factor = k / v.k;
          return clamp({ k, x: centre.x - (centre.x - v.x) * factor, y: centre.y - (centre.y - v.y) * factor });
        });
      }
      (pinch.current as unknown as { lastDistance?: number }).lastDistance = distance;
      return;
    }

    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(vb.width / rect.width, vb.height / rect.height);
    setView((v) => clamp({ ...v, x: v.x + dx * scale, y: v.y + dy * scale }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size < 2) delete (pinch.current as unknown as { lastDistance?: number }).lastDistance;
  };

  const handleClick = (id: TerritoryId) => (e: React.MouseEvent) => {
    if (drag.current && drag.current.moved > 8) return;
    onPick(id, { shift: e.shiftKey, alt: e.altKey || e.metaKey || e.button === 2 });
  };

  const seatOf = (id: TerritoryId) => {
    const owner = state.territories[id].owner;
    const player = state.players.find((p) => p.id === owner);
    return player ? SEATS[player.seat] : null;
  };

  const transform = `translate(${view.x} ${view.y}) scale(${view.k})`;
  const dimmed = Object.values(moods).some((m) => m === 'spento');

  return (
    <div className="mappa">
      <svg
        ref={svgRef}
        className="mappa__svg"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Carta di Vhaldor"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <filter id="tavoliere-alone" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#000" floodOpacity="0.6" />
          </filter>
          <radialGradient id="oceano" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor="#EDE3CE" />
            <stop offset="70%" stopColor="#E2D7BF" />
            <stop offset="100%" stopColor="#D2C4A6" />
          </radialGradient>
          <filter id="rilievo" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#4A3A22" floodOpacity="0.28" />
          </filter>
          <clipPath id="tavoliere-taglio">
            <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} rx="22" />
          </clipPath>
          <filter id="pedina-ombra" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.4" floodColor="#2A2015" floodOpacity="0.45" />
          </filter>
          {SEATS.map((seat, i) => (
            <pattern
              key={seat.pattern}
              id={`trama-${i}`}
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(12)"
            >
              {seat.pattern === 'diagonale' && <path d="M0 16 L16 0" stroke={seat.color} strokeWidth="3" opacity="0.5" />}
              {seat.pattern === 'punti' && <circle cx="4" cy="4" r="2.4" fill={seat.color} opacity="0.5" />}
              {seat.pattern === 'reticolo' && (
                <path d="M0 8 H16 M8 0 V16" stroke={seat.color} strokeWidth="2.2" opacity="0.45" />
              )}
              {seat.pattern === 'verticale' && <path d="M4 0 V16" stroke={seat.color} strokeWidth="3.4" opacity="0.45" />}
              {seat.pattern === 'onde' && (
                <path d="M0 10 Q4 4 8 10 T16 10" fill="none" stroke={seat.color} strokeWidth="2.4" opacity="0.5" />
              )}
              {seat.pattern === 'pieno' && <rect width="16" height="16" fill={seat.color} opacity="0.14" />}
            </pattern>
          ))}
          <marker id="punta-attacco" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L12 6 L0 12 Z" fill="#B3402C" />
          </marker>
          <marker id="punta-spostamento" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L12 6 L0 12 Z" fill="#2F6E4F" />
          </marker>
        </defs>

        <g transform={transform}>
          <rect
            className="mappa__ombra-tavoliere"
            x={vb.x}
            y={vb.y}
            width={vb.width}
            height={vb.height}
            rx="22"
            filter="url(#tavoliere-alone)"
          />
        </g>

        <g transform={transform} clipPath="url(#tavoliere-taglio)">
          <rect
            className="mappa__tavoliere"
            x={vb.x}
            y={vb.y}
            width={vb.width}
            height={vb.height}
            rx="22"
            fill="url(#oceano)"
          />
          {/* reticolo dell'oceano: appena accennato, come su una carta nautica */}
          <g className="mappa__graticola" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <path
                key={`par-${i}`}
                d={`M${vb.x} ${vb.y + (vb.height / 8) * i} Q ${vb.x + vb.width / 2} ${
                  vb.y + (vb.height / 8) * i - 26
                } ${vb.x + vb.width} ${vb.y + (vb.height / 8) * i}`}
              />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <path
                key={`mer-${i}`}
                d={`M${vb.x + (vb.width / 12) * i} ${vb.y} Q ${vb.x + (vb.width / 12) * i + 18} ${
                  vb.y + vb.height / 2
                } ${vb.x + (vb.width / 12) * i} ${vb.y + vb.height}`}
              />
            ))}
          </g>

          {/* silhouette dei continenti: dà spessore alla costa */}
          <g filter="url(#rilievo)">
            {WORLD.landmasses.map((l) => (
              <path key={l.id} d={l.path} fill="#CBBB9C" />
            ))}
          </g>

          <g className="mappa__rotte" aria-hidden="true">
            {WORLD.seaRoutes.map((r) => (
              <path
                key={`${r.from}-${r.to}`}
                d={`M${r.a.x} ${r.a.y} Q ${(r.a.x + r.b.x) / 2} ${(r.a.y + r.b.y) / 2 - 70} ${r.b.x} ${r.b.y}`}
              />
            ))}
          </g>

          <g className="mappa__territori">
            {WORLD.territories.map((t) => {
              const seat = seatOf(t.id);
              const mood = moods[t.id] ?? 'normale';
              const armies = state.territories[t.id].armies;
              const owner = state.players.find((p) => p.id === state.territories[t.id].owner);
              return (
                <g
                  key={t.id}
                  className={`territorio territorio--${mood}${flash.includes(t.id) ? ' territorio--lampo' : ''}`}
                  onClick={handleClick(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick(t.id, { shift: e.shiftKey, alt: e.altKey });
                    }
                  }}
                  tabIndex={mood === 'selezionabile' || mood === 'bersaglio' || mood === 'collegato' ? 0 : -1}
                  role="button"
                  aria-label={`${t.name}, ${owner ? owner.name : 'nessuno'}, ${armies} armate`}
                >
                  <path className="territorio__terra" d={t.path} fill={seat ? seat.land : '#F0E7D5'} />
                  {showPatterns && seat && owner && (
                    <path className="territorio__trama" d={t.path} fill={`url(#trama-${owner.seat})`} />
                  )}
                  <path className="territorio__bordo" d={t.path} />
                </g>
              );
            })}
          </g>

          <g className="mappa__coste" aria-hidden="true">
            {WORLD.landmasses.map((l) => (
              <path key={l.id} d={l.path} />
            ))}
          </g>

          {arrow && <AttackArrow from={arrow.from} to={arrow.to} tone={arrow.tone} animate={animate} />}

          <Compass x={vb.x + 150} y={vb.y + vb.height - 150} />

          <g className="mappa__etichette" aria-hidden="true">
            {WORLD.regions.map((r) => (
              <g key={r.id} className="regione-etichetta">
                <text x={r.label.x} y={r.label.y}>
                  {r.name.toUpperCase()}
                </text>
                <text className="regione-etichetta__bonus" x={r.label.x} y={r.label.y + 30}>
                  +{r.bonus} armate
                </text>
              </g>
            ))}
          </g>

          <g className="mappa__pedine">
            {WORLD.territories.map((t) => {
              const owner = state.players.find((p) => p.id === state.territories[t.id].owner);
              const seat = owner ? SEATS[owner.seat] : null;
              const armies = state.territories[t.id].armies;
              const mood = moods[t.id] ?? 'normale';
              return (
                <g
                  key={t.id}
                  className={`pedina pedina--${mood}${flash.includes(t.id) ? ' pedina--lampo' : ''}`}
                  transform={`translate(${t.center.x} ${t.center.y})`}
                  aria-hidden="true"
                >
                  <text className="pedina__nome" y={TOKEN_R + 25}>
                    {t.name}
                  </text>
                  <g filter="url(#pedina-ombra)">
                    {armies >= 10 && <circle className="pedina__pila" cx={5} cy={5} r={TOKEN_R} fill={seat?.color} />}
                    {armies >= 5 && <circle className="pedina__pila" cx={2.5} cy={2.5} r={TOKEN_R} fill={seat?.color} />}
                    <circle className="pedina__disco" r={TOKEN_R} fill={seat?.color ?? '#9C917E'} />
                    <circle className="pedina__anello" r={TOKEN_R - 4} />
                    <text className="pedina__numero" fill={seat?.ink ?? '#fff'} y={1}>
                      {armies}
                    </text>
                  </g>
                  {seat && (
                    <g className="pedina__stemma" transform={`translate(0 ${-TOKEN_R - 5})`}>
                      <circle r={9} />
                      <path d={symbolPath(seat.symbol, 5.2)} fill={seat.color} />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
          <g className="mappa__perdite" aria-hidden="true">
            {damage.map((d) => (
              <text
                key={d.id}
                className="perdita"
                x={territory(d.territory).center.x}
                y={territory(d.territory).center.y - 30}
              >
                −{d.amount}
              </text>
            ))}
          </g>
          <rect
            className="mappa__cornice"
            x={vb.x + 5}
            y={vb.y + 5}
            width={vb.width - 10}
            height={vb.height - 10}
            rx="18"
          />
        </g>
      </svg>

      <div className="mappa__zoom" role="group" aria-label="Ingrandimento della carta">
        <button type="button" onClick={() => setView((v) => clamp({ ...v, k: v.k * 1.25 }))} aria-label="Avvicina">
          +
        </button>
        <button type="button" onClick={() => setView((v) => clamp({ ...v, k: v.k / 1.25 }))} aria-label="Allontana">
          −
        </button>
        <button type="button" onClick={() => setView(FIT)} aria-label="Inquadra tutta la carta">
          ⤢
        </button>
      </div>
      {dimmed && <span className="mappa__suggerimento-schermo" aria-hidden="true" />}
    </div>
  );
});

function Compass({ x, y }: { x: number; y: number }) {
  const punte = [0, 90, 180, 270];
  return (
    <g className="bussola" transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r="58" />
      <circle r="44" />
      {punte.map((a) => (
        <path key={a} className="bussola__punta" d="M0 -56 L11 0 L0 20 L-11 0 Z" transform={`rotate(${a})`} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} className="bussola__punta bussola__punta--minore" d="M0 -38 L7 0 L0 13 L-7 0 Z" transform={`rotate(${a})`} />
      ))}
      <text className="bussola__nord" y="-66">
        N
      </text>
    </g>
  );
}

function AttackArrow({
  from,
  to,
  tone,
  animate,
}: {
  from: TerritoryId;
  to: TerritoryId;
  tone: 'attacco' | 'spostamento';
  animate: boolean;
}) {
  const a = territory(from).center;
  const b = territory(to).center;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // arco leggero, perpendicolare alla congiungente
  const bend = Math.min(60, length * 0.18);
  const cx = mx - (dy / length) * bend;
  const cy = my + (dx / length) * bend;
  const shrink = 30 / length;
  const start = { x: a.x + dx * shrink, y: a.y + dy * shrink };
  const end = { x: b.x - dx * shrink, y: b.y - dy * shrink };
  return (
    <path
      className={`freccia freccia--${tone}${animate ? ' freccia--viva' : ''}`}
      d={`M${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
      markerEnd={`url(#punta-${tone})`}
    />
  );
}

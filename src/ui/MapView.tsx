/**
 * Il tavolo di gioco.
 *
 * Tutta la mappa e' un solo SVG: nessuna griglia, nessuna lista di territori.
 * Si gioca toccando la carta.
 *
 * Due accorgimenti tengono il disegno fluido:
 *  - la telecamera scrive il proprio transform fuori da React (useCamera), per
 *    cui trascinare o ingrandire non ridisegna nulla;
 *  - ogni territorio e ogni pedina sono componenti memoizzati con proprieta'
 *    elementari, per cui un'azione ridisegna solo le caselle che cambiano.
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import { WORLD, type TerritoryId, region, territory } from '../game/world';
import type { GameState } from '../game/types';
import { SEATS, symbolPath } from './palette';
import { useCamera } from './useCamera';

export type TerritoryMood = 'normale' | 'selezionabile' | 'selezionato' | 'bersaglio' | 'collegato' | 'spento';

export interface MapViewProps {
  state: GameState;
  moods: Record<TerritoryId, TerritoryMood>;
  onPick(id: TerritoryId, event: { shift: boolean; alt: boolean }): void;
  /** freccia dell'azione in corso (attacco o spostamento) */
  arrow?: { from: TerritoryId; to: TerritoryId; tone: 'attacco' | 'spostamento' } | null;
  /** territori da far pulsare dopo un evento */
  flash?: TerritoryId[];
  /** variazioni di armate da mostrare sulla carta, come gettoni tolti dal tavolo */
  damage?: { id: number; territory: TerritoryId; amount: number }[];
  /** territori da inquadrare: cambiando la chiave la telecamera ci si sposta */
  focus?: { key: string; ids: TerritoryId[] } | null;
  showPatterns: boolean;
  animate: boolean;
}

const TOKEN_R = 23;

export const MapView = memo(function MapView({
  state,
  moods,
  onPick,
  arrow,
  flash = [],
  damage = [],
  focus,
  showPatterns,
  animate,
}: MapViewProps) {
  const vb = WORLD.viewBox;
  const camera = useCamera(vb, !animate);
  const trascinamento = useRef<{ x: number; y: number; mosso: number; puntatore: number } | null>(null);
  const pizzico = useRef<Map<number, { x: number; y: number }>>(new Map());
  const distanzaPizzico = useRef(0);
  const primaInquadratura = useRef(false);

  // --- telecamera: prima inquadratura e messa a fuoco sull'azione ---
  useEffect(() => {
    if (primaInquadratura.current) return;
    primaInquadratura.current = true;
    camera.inquadraTutto(0);
  }, [camera]);

  useEffect(() => {
    const el = camera.svg.current;
    if (!el) return;
    const osservatore = new ResizeObserver(() => camera.scrivi());
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [camera]);

  const chiaveFuoco = focus?.key ?? '';
  useEffect(() => {
    if (!chiaveFuoco) return;
    // senza territori indicati si torna a inquadrare tutto il tabellone
    if (!focus?.ids.length) camera.inquadraTutto();
    else camera.inquadra(focus.ids.map((id) => territory(id).center));
  }, [chiaveFuoco]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- puntatore ---
  useEffect(() => {
    const nodo = camera.svg.current;
    if (!nodo) return;
    const suRotella = (e: WheelEvent) => {
      e.preventDefault();
      camera.zoomSu(e.clientX, e.clientY, e.deltaY < 0 ? 1.14 : 1 / 1.14);
    };
    nodo.addEventListener('wheel', suRotella, { passive: false });
    return () => nodo.removeEventListener('wheel', suRotella);
  }, [camera]);

  const giuPuntatore = (e: React.PointerEvent) => {
    pizzico.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pizzico.current.size === 1) {
      trascinamento.current = { x: e.clientX, y: e.clientY, mosso: 0, puntatore: e.pointerId };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const muoviPuntatore = (e: React.PointerEvent) => {
    if (!pizzico.current.has(e.pointerId)) return;
    const precedente = pizzico.current.get(e.pointerId)!;
    pizzico.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pizzico.current.size >= 2) {
      const [a, b] = [...pizzico.current.values()];
      const distanza = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanzaPizzico.current) {
        camera.zoomSu((a.x + b.x) / 2, (a.y + b.y) / 2, distanza / distanzaPizzico.current);
      }
      distanzaPizzico.current = distanza;
      return;
    }

    if (!trascinamento.current || trascinamento.current.puntatore !== e.pointerId) return;
    const dx = e.clientX - precedente.x;
    const dy = e.clientY - precedente.y;
    trascinamento.current.mosso += Math.abs(dx) + Math.abs(dy);
    camera.trascina(dx, dy);
  };

  const suPuntatore = (e: React.PointerEvent) => {
    pizzico.current.delete(e.pointerId);
    if (pizzico.current.size < 2) distanzaPizzico.current = 0;
  };

  const scegli = useCallback(
    (id: TerritoryId, mods: { shift: boolean; alt: boolean }) => {
      if (trascinamento.current && trascinamento.current.mosso > 8) return;
      onPick(id, mods);
    },
    [onPick],
  );

  const spenta = Object.values(moods).some((m) => m === 'spento');

  return (
    <div className="mappa">
      <svg
        ref={camera.svg}
        className={`mappa__svg${spenta ? ' mappa__svg--concentrata' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="Carta di Vhaldor"
        onPointerDown={giuPuntatore}
        onPointerMove={muoviPuntatore}
        onPointerUp={suPuntatore}
        onPointerCancel={suPuntatore}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Definizioni />

        <g ref={camera.nodo}>
          {/* ombra del tabellone come cornici concentriche: un filtro qui
              costringerebbe il browser a rigenerare la sfocatura a ogni
              fotogramma della panoramica */}
          {[
            { d: 34, o: 0.16 },
            { d: 20, o: 0.22 },
            { d: 9, o: 0.3 },
          ].map((strato) => (
            <rect
              key={strato.d}
              className="mappa__ombra-tavoliere"
              x={vb.x - strato.d}
              y={vb.y - strato.d + 10}
              width={vb.width + strato.d * 2}
              height={vb.height + strato.d * 2}
              rx={26 + strato.d}
              opacity={strato.o}
            />
          ))}
          <rect
            className="mappa__tavoliere"
            x={vb.x}
            y={vb.y}
            width={vb.width}
            height={vb.height}
            rx="26"
            fill="url(#oceano)"
          />

          <g>
            {/* reticolo dell'oceano, appena accennato come su una carta nautica */}
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

            {/* fondali: anelli di profondita' attorno a ogni massa di terra */}
            <g className="mappa__fondali" aria-hidden="true">
              {WORLD.landmasses.map((l) => (
                <g key={l.id}>
                  <path d={l.path} className="fondale fondale--due" />
                  <path d={l.path} className="fondale fondale--uno" />
                </g>
              ))}
            </g>

            <g className="mappa__rotte" aria-hidden="true">
              {WORLD.seaRoutes.map((r) => (
                <path key={`${r.from}-${r.to}`} d={rottaMarittima(r.a, r.b)} />
              ))}
            </g>

            {/* silhouette dei continenti: da' spessore alla costa */}
            <g className="mappa__zolle" aria-hidden="true">
              {WORLD.landmasses.map((l) => (
                <path key={`ombra-${l.id}`} className="zolla__ombra" d={l.path} transform="translate(0 11)" />
              ))}
              {WORLD.landmasses.map((l) => (
                <path key={l.id} className="zolla" d={l.path} />
              ))}
            </g>

            <g className="mappa__territori">
              {WORLD.territories.map((t) => {
                const casella = state.territories[t.id];
                const proprietario = state.players.find((p) => p.id === casella.owner);
                return (
                  <Territorio
                    key={t.id}
                    id={t.id}
                    nome={t.name}
                    path={t.path}
                    seat={proprietario ? proprietario.seat : -1}
                    proprietario={proprietario ? proprietario.name : 'nessuno'}
                    armate={casella.armies}
                    umore={moods[t.id] ?? 'normale'}
                    lampo={flash.includes(t.id)}
                    trama={showPatterns}
                    onPick={scegli}
                  />
                );
              })}
            </g>

            {/* confini delle macro-regioni, come sul tabellone stampato */}
            <g className="mappa__coste" aria-hidden="true">
              {WORLD.landmasses.map((l) => (
                <path key={l.id} d={l.path} stroke={region(l.id).accent} />
              ))}
            </g>

            <g className="mappa__grana" aria-hidden="true">
              <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#grana)" />
            </g>

            {arrow && <AttackArrow from={arrow.from} to={arrow.to} tone={arrow.tone} animate={animate} />}

            <Bussola x={vb.x + 165} y={vb.y + vb.height - 165} />

            <g className="mappa__cartigli" aria-hidden="true">
              {WORLD.regions.map((r) => (
                <Cartiglio key={r.id} nome={r.name} bonus={r.bonus} accent={r.accent} x={r.label.x} y={r.label.y} />
              ))}
            </g>

            <g className="mappa__nomi" aria-hidden="true">
              {WORLD.territories.map((t) => (
                <text
                  key={t.id}
                  className="pedina__nome"
                  x={t.center.x + t.label.x}
                  y={t.center.y + t.label.y}
                >
                  {t.name}
                </text>
              ))}
            </g>

            <g className="mappa__pedine">
              {WORLD.territories.map((t) => {
                const casella = state.territories[t.id];
                const proprietario = state.players.find((p) => p.id === casella.owner);
                return (
                  <Pedina
                    key={t.id}
                    x={t.center.x}
                    y={t.center.y}
                    armate={casella.armies}
                    seat={proprietario ? proprietario.seat : -1}
                    umore={moods[t.id] ?? 'normale'}
                    lampo={flash.includes(t.id)}
                  />
                );
              })}
            </g>

            <g className="mappa__perdite" aria-hidden="true">
              {damage.map((d) => (
                <text
                  key={d.id}
                  className={`perdita${d.amount > 0 ? ' perdita--piu' : ''}`}
                  x={territory(d.territory).center.x}
                  y={territory(d.territory).center.y - 34}
                >
                  {d.amount > 0 ? `+${d.amount}` : d.amount}
                </text>
              ))}
            </g>

            <rect
              className="mappa__vignetta"
              x={vb.x}
              y={vb.y}
              width={vb.width}
              height={vb.height}
              rx="26"
              fill="url(#vignetta)"
            />
          </g>

          <rect
            className="mappa__cornice"
            x={vb.x + 6}
            y={vb.y + 6}
            width={vb.width - 12}
            height={vb.height - 12}
            rx="20"
          />
        </g>
      </svg>

      <div className="mappa__zoom" role="group" aria-label="Ingrandimento della carta">
        <button type="button" onClick={() => camera.zoomCentro(1.35)} aria-label="Avvicina">
          +
        </button>
        <button type="button" onClick={() => camera.zoomCentro(1 / 1.35)} aria-label="Allontana">
          −
        </button>
        <button type="button" onClick={() => camera.inquadraTutto()} aria-label="Inquadra tutta la carta">
          ⤢
        </button>
      </div>
    </div>
  );
});

// --- territorio -----------------------------------------------------------

interface TerritorioProps {
  id: TerritoryId;
  nome: string;
  path: string;
  seat: number;
  proprietario: string;
  armate: number;
  umore: TerritoryMood;
  lampo: boolean;
  trama: boolean;
  onPick(id: TerritoryId, mods: { shift: boolean; alt: boolean }): void;
}

const Territorio = memo(function Territorio({
  id,
  nome,
  path,
  seat,
  proprietario,
  armate,
  umore,
  lampo,
  trama,
  onPick,
}: TerritorioProps) {
  const casa = seat >= 0 ? SEATS[seat] : null;
  const attivabile = umore === 'selezionabile' || umore === 'bersaglio' || umore === 'collegato';
  return (
    <g
      className={`territorio territorio--${umore}${lampo ? ' territorio--lampo' : ''}`}
      onClick={(e) => onPick(id, { shift: e.shiftKey, alt: e.altKey || e.metaKey })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(id, { shift: e.shiftKey, alt: e.altKey });
        }
      }}
      tabIndex={attivabile ? 0 : -1}
      role="button"
      aria-label={`${nome}, ${proprietario}, ${armate} armate`}
    >
      <path className="territorio__terra" d={path} fill={casa ? casa.land : '#E4D8BC'} />
      {trama && casa && <path className="territorio__trama" d={path} fill={`url(#trama-${seat})`} />}
      <path className="territorio__rilievo" d={path} />
      <path className="territorio__bordo" d={path} stroke={casa ? casa.edge : '#8A7550'} />
    </g>
  );
});

// --- pedina ---------------------------------------------------------------

interface PedinaProps {
  x: number;
  y: number;
  armate: number;
  seat: number;
  umore: TerritoryMood;
  lampo: boolean;
}

/** quanti dischi impilare: la pila cresce con le armate, come sul tavolo */
function altezzaPila(armate: number): number {
  if (armate >= 13) return 3;
  if (armate >= 7) return 2;
  if (armate >= 4) return 1;
  return 0;
}

const Pedina = memo(function Pedina({ x, y, armate, seat, umore, lampo }: PedinaProps) {
  const casa = seat >= 0 ? SEATS[seat] : null;
  const pila = altezzaPila(armate);
  const cima = -pila * 6;
  return (
    <g
      className={`pedina pedina--${umore}${lampo ? ' pedina--lampo' : ''}`}
      transform={`translate(${x} ${y})`}
      aria-hidden="true"
    >
      <ellipse className="pedina__ombra" cy={9} rx={TOKEN_R * 1.05} ry={TOKEN_R * 0.42} />
      <g className="pedina__gruppo" key={armate}>
        {Array.from({ length: pila }, (_, i) => (
          <circle key={i} className="pedina__strato" cy={-i * 6} r={TOKEN_R} fill={casa?.dark ?? '#6A6154'} />
        ))}
        <circle className="pedina__disco" cy={cima} r={TOKEN_R} fill={casa ? `url(#disco-${seat})` : '#9C917E'} />
        <circle
          className="pedina__rim"
          cy={cima}
          r={TOKEN_R - 1}
          stroke={casa?.dark ?? '#4A4335'}
        />
        <circle className="pedina__solco" cy={cima} r={TOKEN_R - 5.5} stroke={casa?.light ?? '#fff'} />
        <path
          className="pedina__luce"
          d={`M${-TOKEN_R * 0.68} ${cima - TOKEN_R * 0.42} A ${TOKEN_R * 0.82} ${TOKEN_R * 0.82} 0 0 1 ${
            TOKEN_R * 0.34
          } ${cima - TOKEN_R * 0.76}`}
        />
        <text className="pedina__numero" y={cima + 1} fill={casa?.ink ?? '#fff'}>
          {armate}
        </text>
        {casa && (
          <g className="pedina__stemma" transform={`translate(0 ${cima - TOKEN_R - 3})`}>
            <circle r={8.5} />
            <path d={symbolPath(casa.symbol, 4.8)} fill={casa.color} />
          </g>
        )}
      </g>
    </g>
  );
});

// --- ornamenti ------------------------------------------------------------

function Cartiglio({
  nome,
  bonus,
  accent,
  x,
  y,
}: {
  nome: string;
  bonus: number;
  accent: string;
  x: number;
  y: number;
}) {
  const larghezza = nome.length * 27 + 150;
  return (
    <g className="cartiglio" transform={`translate(${x} ${y})`}>
      <rect className="cartiglio__fondo" x={-larghezza / 2} y={-30} width={larghezza} height={48} rx={24} />
      <rect
        className="cartiglio__filo"
        x={-larghezza / 2 + 4}
        y={-26}
        width={larghezza - 8}
        height={40}
        rx={20}
        stroke={accent}
      />
      <text className="cartiglio__nome" x={-26} y={2} fill={accent}>
        {nome.toUpperCase()}
      </text>
      <g transform={`translate(${larghezza / 2 - 44} -6)`}>
        <path className="cartiglio__scudo" d="M-19 -16 H19 V4 Q19 16 0 22 Q-19 16 -19 4 Z" fill={accent} />
        <text className="cartiglio__bonus" y={5}>
          +{bonus}
        </text>
      </g>
    </g>
  );
}

/** Arco di una rotta marittima: piu' e' lunga, piu' si inarca sull'oceano
 *  aperto, cosi' non attraversa le terre emerse che le stanno in mezzo. */
function rottaMarittima(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const lunghezza = Math.hypot(b.x - a.x, b.y - a.y);
  const curva = Math.min(150, 45 + lunghezza * 0.07);
  return `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - curva} ${b.x} ${b.y}`;
}

function Bussola({ x, y }: { x: number; y: number }) {
  return (
    <g className="bussola" transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r="62" />
      <circle r="47" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} className="bussola__punta" d="M0 -58 L11 0 L0 20 L-11 0 Z" transform={`rotate(${a})`} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path
          key={a}
          className="bussola__punta bussola__punta--minore"
          d="M0 -40 L7 0 L0 13 L-7 0 Z"
          transform={`rotate(${a})`}
        />
      ))}
      <text className="bussola__nord" y="-70">
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
  const lunghezza = Math.hypot(dx, dy) || 1;
  const curva = Math.min(60, lunghezza * 0.18);
  const cx = mx - (dy / lunghezza) * curva;
  const cy = my + (dx / lunghezza) * curva;
  const taglio = 32 / lunghezza;
  const inizio = { x: a.x + dx * taglio, y: a.y + dy * taglio };
  const fine = { x: b.x - dx * taglio, y: b.y - dy * taglio };
  const d = `M${inizio.x} ${inizio.y} Q ${cx} ${cy} ${fine.x} ${fine.y}`;
  return (
    <g className={`freccia freccia--${tone}${animate ? ' freccia--viva' : ''}`}>
      <path className="freccia__alone" d={d} />
      <path className="freccia__tratto" d={d} markerEnd={`url(#punta-${tone})`} />
    </g>
  );
}

// --- definizioni comuni ---------------------------------------------------

const Definizioni = memo(function Definizioni() {
  return (
    <defs>
      <radialGradient id="oceano" cx="50%" cy="40%" r="80%">
        <stop offset="0%" stopColor="#F0E7D2" />
        <stop offset="62%" stopColor="#E2D6BA" />
        <stop offset="100%" stopColor="#CFBE9B" />
      </radialGradient>

      <radialGradient id="vignetta" cx="50%" cy="48%" r="72%">
        <stop offset="60%" stopColor="#3A2E16" stopOpacity="0" />
        <stop offset="100%" stopColor="#3A2E16" stopOpacity="0.3" />
      </radialGradient>

      {SEATS.map((seat, i) => (
        <radialGradient key={seat.name} id={`disco-${i}`} cx="32%" cy="26%" r="82%">
          <stop offset="0%" stopColor={seat.light} />
          <stop offset="42%" stopColor={seat.color} />
          <stop offset="88%" stopColor={seat.color} />
          <stop offset="100%" stopColor={seat.dark} />
        </radialGradient>
      ))}

      {/* grana della carta: un motivo minuscolo ripetuto, molto piu' leggero
          di un filtro di rumore su tutta la superficie */}
      <pattern id="grana" width="180" height="180" patternUnits="userSpaceOnUse">
        <circle cx="22" cy="31" r="1.6" fill="#7A6642" opacity="0.12" />
        <circle cx="104" cy="16" r="1.3" fill="#7A6642" opacity="0.1" />
        <circle cx="152" cy="74" r="1.7" fill="#7A6642" opacity="0.11" />
        <circle cx="58" cy="112" r="1.2" fill="#7A6642" opacity="0.1" />
        <circle cx="131" cy="148" r="1.5" fill="#7A6642" opacity="0.12" />
        <circle cx="12" cy="162" r="1.3" fill="#7A6642" opacity="0.1" />
        <circle cx="86" cy="62" r="1.1" fill="#7A6642" opacity="0.09" />
        <circle cx="168" cy="122" r="1.2" fill="#7A6642" opacity="0.1" />
      </pattern>

      {SEATS.map((seat, i) => (
        <pattern
          key={seat.pattern}
          id={`trama-${i}`}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(12)"
        >
          {seat.pattern === 'diagonale' && <path d="M0 16 L16 0" stroke={seat.dark} strokeWidth="2.6" opacity="0.4" />}
          {seat.pattern === 'punti' && <circle cx="4" cy="4" r="2.2" fill={seat.dark} opacity="0.38" />}
          {seat.pattern === 'reticolo' && (
            <path d="M0 8 H16 M8 0 V16" stroke={seat.dark} strokeWidth="1.9" opacity="0.34" />
          )}
          {seat.pattern === 'verticale' && <path d="M4 0 V16" stroke={seat.dark} strokeWidth="3" opacity="0.34" />}
          {seat.pattern === 'onde' && (
            <path d="M0 10 Q4 4 8 10 T16 10" fill="none" stroke={seat.dark} strokeWidth="2.2" opacity="0.38" />
          )}
          {seat.pattern === 'pieno' && <rect width="16" height="16" fill={seat.dark} opacity="0.12" />}
        </pattern>
      ))}

      <marker id="punta-attacco" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L12 6 L0 12 Z" fill="#C0392B" />
      </marker>
      <marker
        id="punta-spostamento"
        viewBox="0 0 12 12"
        refX="9"
        refY="6"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M0 0 L12 6 L0 12 Z" fill="#2F8055" />
      </marker>
    </defs>
  );
});

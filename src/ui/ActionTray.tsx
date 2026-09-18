/**
 * Il "tavolino" che compare sul bordo della carta durante un'azione:
 * scontro in corso, avanzata dopo una conquista, spostamento strategico.
 * Non è una finestra modale: la mappa resta visibile e cliccabile.
 */
import { useEffect, useState } from 'react';
import { DiceRow } from './Dice';
import { Icona } from './Icons';
import type { RollResult } from './../game/types';
import { territoryName } from '../game/world';

export interface BattleTrayProps {
  kind: 'battaglia';
  from: string;
  to: string;
  attackerArmies: number;
  defenderArmies: number;
  maxDice: number;
  odds: number | null;
  lastRoll: RollResult | null;
  rolling: boolean;
  onRoll(dice: number): void;
  onCancel(): void;
}

export interface AdvanceTrayProps {
  kind: 'avanzata';
  from: string;
  to: string;
  min: number;
  max: number;
  onConfirm(armies: number): void;
}

export interface MoveTrayProps {
  kind: 'spostamento';
  from: string;
  to: string;
  max: number;
  onConfirm(armies: number): void;
  onCancel(): void;
}

export type ActionTrayProps = BattleTrayProps | AdvanceTrayProps | MoveTrayProps;

export function ActionTray(props: ActionTrayProps) {
  if (props.kind === 'battaglia') return <BattleTray {...props} />;
  if (props.kind === 'avanzata') return <AdvanceTray {...props} />;
  return <MoveTray {...props} />;
}

function BattleTray({
  from,
  to,
  attackerArmies,
  defenderArmies,
  maxDice,
  odds,
  lastRoll,
  rolling,
  onRoll,
  onCancel,
}: BattleTrayProps) {
  const [dice, setDice] = useState(maxDice);
  useEffect(() => setDice((d) => Math.min(Math.max(1, d), Math.max(1, maxDice))), [maxDice]);

  const attackOutcomes = lastRoll
    ? lastRoll.attack.map((v, i) =>
        i < lastRoll.defence.length ? (v > lastRoll.defence[i] ? ('vinto' as const) : ('perso' as const)) : null,
      )
    : [];
  const defenceOutcomes = lastRoll
    ? lastRoll.defence.map((v, i) =>
        i < lastRoll.attack.length ? (v >= lastRoll.attack[i] ? ('vinto' as const) : ('perso' as const)) : null,
      )
    : [];

  return (
    <section className="tavolino tavolino--battaglia" aria-label="Scontro in corso">
      <header className="tavolino__testa">
        <span className="tavolino__titolo">
          {territoryName(from)} <Icona nome="attacco" size={14} /> {territoryName(to)}
        </span>
        <span className="tavolino__conteggio">
          {attackerArmies} contro {defenderArmies}
          {odds !== null && <em> · riuscita {Math.round(odds * 100)}%</em>}
        </span>
      </header>

      <div className="tavolino__dadi">
        <DiceRow values={lastRoll?.attack ?? []} tone="attacco" outcomes={attackOutcomes} rolling={rolling} label="Attacco" />
        <DiceRow values={lastRoll?.defence ?? []} tone="difesa" outcomes={defenceOutcomes} rolling={rolling} label="Difesa" />
      </div>

      {lastRoll && !rolling && (
        <p className="tavolino__esito">
          {lastRoll.conquered
            ? 'Territorio conquistato.'
            : `Perdite: tu −${lastRoll.attackerLosses}, avversario −${lastRoll.defenderLosses}.`}
        </p>
      )}

      <div className="tavolino__comandi">
        <div className="scelta-dadi" role="group" aria-label="Quanti dadi lanciare">
          {Array.from({ length: Math.max(1, maxDice) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`scelta-dadi__voce${n === dice ? ' scelta-dadi__voce--attiva' : ''}`}
              onClick={() => setDice(n)}
              aria-pressed={n === dice}
            >
              {n}
            </button>
          ))}
          <span className="scelta-dadi__nota">{dice === 1 ? 'dado' : 'dadi'}</span>
        </div>
        <button type="button" className="bottone bottone--primario" onClick={() => onRoll(dice)} disabled={rolling}>
          <Icona nome="dadi" /> Lancia
        </button>
        <button type="button" className="bottone bottone--fantasma" onClick={onCancel} disabled={rolling}>
          Ritirati
        </button>
      </div>
    </section>
  );
}

function AdvanceTray({ from, to, min, max, onConfirm }: AdvanceTrayProps) {
  const [armies, setArmies] = useState(max);
  useEffect(() => setArmies(max), [max, from, to]);
  return (
    <section className="tavolino tavolino--avanzata" aria-label="Avanzata dopo la conquista">
      <header className="tavolino__testa">
        <span className="tavolino__titolo">{territoryName(to)} è tuo</span>
        <span className="tavolino__conteggio">Quante armate lasci avanzare da {territoryName(from)}?</span>
      </header>
      <Stepper value={armies} min={min} max={max} onChange={setArmies} label="Armate che avanzano" />
      <div className="tavolino__comandi">
        <button type="button" className="bottone bottone--primario" onClick={() => onConfirm(armies)}>
          Fai avanzare {armies}
        </button>
      </div>
    </section>
  );
}

function MoveTray({ from, to, max, onConfirm, onCancel }: MoveTrayProps) {
  const [armies, setArmies] = useState(Math.max(1, Math.floor(max / 2)));
  useEffect(() => setArmies(Math.max(1, Math.floor(max / 2))), [max, from, to]);
  return (
    <section className="tavolino tavolino--spostamento" aria-label="Spostamento strategico">
      <header className="tavolino__testa">
        <span className="tavolino__titolo">
          {territoryName(from)} <Icona nome="spostamento" size={14} /> {territoryName(to)}
        </span>
        <span className="tavolino__conteggio">Un solo spostamento per turno</span>
      </header>
      <Stepper value={armies} min={1} max={max} onChange={setArmies} label="Armate da spostare" />
      <div className="tavolino__comandi">
        <button type="button" className="bottone bottone--primario" onClick={() => onConfirm(armies)}>
          Sposta {armies}
        </button>
        <button type="button" className="bottone bottone--fantasma" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </section>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="contatore">
      <button type="button" className="contatore__passo" onClick={() => onChange(clamp(value - 1))} aria-label="Una in meno">
        −
      </button>
      <input
        className="contatore__cursore"
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button type="button" className="contatore__passo" onClick={() => onChange(clamp(value + 1))} aria-label="Una in più">
        +
      </button>
      <output className="contatore__valore">{value}</output>
    </div>
  );
}

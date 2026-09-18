/** Traduzione degli eventi di gioco in righe di cronologia leggibili. */
import type { GameEvent } from './types';
import { region, territoryName } from './world';
import { SYMBOL_LABEL } from './cards';

export type LogTone = 'neutro' | 'battaglia' | 'conquista' | 'sistema' | 'allarme';

export interface LogLine {
  text: string;
  tone: LogTone;
  icon: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function describeEvent(event: GameEvent, nameOf: (id: string) => string): LogLine {
  switch (event.type) {
    case 'partita/iniziata':
      return {
        text: `Partita avviata con ${event.players} giocatori — modalità ${
          event.mode === 'dominio' ? 'dominio totale' : 'obiettivi segreti'
        }.`,
        tone: 'sistema',
        icon: 'inizio',
      };
    case 'turno/iniziato':
      return { text: `Turno ${event.turn} — tocca a ${nameOf(event.player)}.`, tone: 'sistema', icon: 'turno' };
    case 'schieramento/posa':
      return {
        text: `${nameOf(event.player)} presidia ${territoryName(event.territory)}.`,
        tone: 'neutro',
        icon: 'armata',
      };
    case 'rinforzo/assegnato': {
      const bonus = event.regions.length
        ? ` (${event.regions.map((r) => `${region(r.region).name} +${r.bonus}`).join(', ')})`
        : '';
      return {
        text: `${nameOf(event.player)} riceve ${plural(event.total, 'armata', 'armate')}${bonus}.`,
        tone: 'neutro',
        icon: 'rinforzo',
      };
    }
    case 'rinforzo/posa':
      return {
        text: `${nameOf(event.player)} schiera ${plural(event.count, 'armata', 'armate')} in ${territoryName(event.territory)}.`,
        tone: 'neutro',
        icon: 'armata',
      };
    case 'carte/giocate': {
      const bonus = event.bonusTerritory ? `, +2 su ${territoryName(event.bonusTerritory)}` : '';
      return {
        text: `${nameOf(event.player)} gioca ${event.symbols
          .map((s) => SYMBOL_LABEL[s])
          .join(' + ')} e ottiene ${plural(event.armies, 'armata', 'armate')}${bonus}.`,
        tone: 'sistema',
        icon: 'carte',
      };
    }
    case 'carte/pescata':
      return { text: `${nameOf(event.player)} pesca una carta conquista.`, tone: 'sistema', icon: 'carte' };
    case 'attacco/dichiarato':
      return {
        text: `${nameOf(event.player)} punta su ${territoryName(event.to)} da ${territoryName(event.from)}.`,
        tone: 'battaglia',
        icon: 'attacco',
      };
    case 'attacco/risolto': {
      const r = event.roll;
      return {
        text: `${territoryName(event.from)} → ${territoryName(event.to)}: ${r.attack.join('-')} contro ${r.defence.join(
          '-',
        )}. ${nameOf(event.player)} perde ${r.attackerLosses}, ${nameOf(event.defender)} perde ${r.defenderLosses}.`,
        tone: 'battaglia',
        icon: 'dadi',
      };
    }
    case 'territorio/conquistato':
      return {
        text: `${nameOf(event.player)} conquista ${territoryName(event.territory)} a spese di ${nameOf(event.from)}.`,
        tone: 'conquista',
        icon: 'bandiera',
      };
    case 'armate/avanzate':
      return {
        text: `${plural(event.armies, 'armata avanza', 'armate avanzano')} in ${territoryName(event.to)}.`,
        tone: 'conquista',
        icon: 'armata',
      };
    case 'spostamento/eseguito':
      return {
        text: `${nameOf(event.player)} sposta ${plural(event.armies, 'armata', 'armate')} da ${territoryName(
          event.from,
        )} a ${territoryName(event.to)}.`,
        tone: 'neutro',
        icon: 'spostamento',
      };
    case 'giocatore/eliminato':
      return {
        text: `${nameOf(event.player)} è fuori gioco: ${nameOf(event.by)} ne raccoglie ${plural(
          event.cards,
          'carta',
          'carte',
        )}.`,
        tone: 'allarme',
        icon: 'eliminazione',
      };
    case 'fase/cambiata':
      return { text: `Fase di ${event.phase}.`, tone: 'sistema', icon: 'fase' };
    case 'partita/conclusa': {
      const reason =
        event.reason === 'obiettivo'
          ? 'completando l’obiettivo segreto'
          : event.reason === 'dominio'
            ? 'conquistando l’intera mappa'
            : 'restando l’ultimo in gioco';
      return { text: `${nameOf(event.winner)} vince ${reason}.`, tone: 'conquista', icon: 'vittoria' };
    }
    default:
      return { text: '', tone: 'neutro', icon: 'turno' };
  }
}

/**
 * Atlante di Vhaldor: tipi e indici sulla mappa generata.
 *
 * La geometria vive in world.data.ts (file generato). Qui esponiamo solo
 * strutture immutabili e funzioni di lettura: la mappa non cambia mai
 * durante una partita.
 */
import { WORLD_DATA } from './world.data';

export type TerritoryId = string;
export type RegionId = string;

export interface Point {
  x: number;
  y: number;
}

export interface RegionData {
  id: RegionId;
  name: string;
  /** armate extra a inizio turno per chi controlla l'intera regione */
  bonus: number;
  accent: string;
  territories: TerritoryId[];
  label: Point;
}

export interface TerritoryData {
  id: TerritoryId;
  name: string;
  region: RegionId;
  /** numero di celle del reticolo: usato solo come indicatore di superficie */
  size: number;
  /** contorno SVG già pronto */
  path: string;
  /** ancora per segnalino ed etichetta, sempre interna al territorio */
  center: Point;
  neighbours: TerritoryId[];
}

export interface WorldMap {
  regions: RegionData[];
  territories: TerritoryData[];
  landmasses: { id: RegionId; path: string }[];
  seaRoutes: { from: TerritoryId; to: TerritoryId; a: Point; b: Point }[];
  viewBox: { x: number; y: number; width: number; height: number };
}

export const WORLD: WorldMap = WORLD_DATA;

export const TERRITORIES: TerritoryData[] = WORLD.territories;
export const REGIONS: RegionData[] = WORLD.regions;

const territoryIndex = new Map(TERRITORIES.map((t) => [t.id, t]));
const regionIndex = new Map(REGIONS.map((r) => [r.id, r]));

export const TERRITORY_IDS: TerritoryId[] = TERRITORIES.map((t) => t.id);
export const TERRITORY_COUNT = TERRITORIES.length;

export function territory(id: TerritoryId): TerritoryData {
  const t = territoryIndex.get(id);
  if (!t) throw new Error(`Territorio sconosciuto: ${id}`);
  return t;
}

export function region(id: RegionId): RegionData {
  const r = regionIndex.get(id);
  if (!r) throw new Error(`Regione sconosciuta: ${id}`);
  return r;
}

export function territoryName(id: TerritoryId): string {
  return territory(id).name;
}

export function areNeighbours(a: TerritoryId, b: TerritoryId): boolean {
  return territory(a).neighbours.includes(b);
}

/** rotte marittime indicizzate per coppia, per disegnarle in evidenza */
const seaRouteKeys = new Set(WORLD.seaRoutes.flatMap((r) => [`${r.from}|${r.to}`, `${r.to}|${r.from}`]));

export function isSeaRoute(a: TerritoryId, b: TerritoryId): boolean {
  return seaRouteKeys.has(`${a}|${b}`);
}

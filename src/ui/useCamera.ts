/**
 * Telecamera della carta.
 *
 * Panoramica e zoom non passano dallo stato di React: la posizione vive in un
 * riferimento e viene scritta direttamente sul nodo SVG dentro un
 * requestAnimationFrame. Trascinare la carta quindi non ridisegna i
 * quarantadue territori a ogni movimento del dito, e resta fluido anche
 * mentre i bot giocano.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface Camera {
  k: number;
  x: number;
  y: number;
}

export interface Riquadro {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_K = 0.7;
const MAX_K = 6;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function useCamera(viewBox: Riquadro, ridottaAnimazione = false) {
  const nodo = useRef<SVGGElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const cam = useRef<Camera>({ k: 1, x: 0, y: 0 });
  const animazione = useRef(0);
  const quiete = useRef(0);

  /**
   * Mentre la carta si muove i dettagli piu' costosi da disegnare (i nomi con
   * l'alone, la grana della carta, il reticolo) vengono sospesi: tornano da
   * soli un attimo dopo che ci si ferma. E' cio' che fa la differenza fra una
   * panoramica a scatti e una fluida.
   */
  const segnalaMovimento = useCallback(() => {
    const el = svg.current;
    if (!el) return;
    el.classList.add('mappa__svg--in-movimento');
    window.clearTimeout(quiete.current);
    quiete.current = window.setTimeout(() => el.classList.remove('mappa__svg--in-movimento'), 180);
  }, []);

  const scrivi = useCallback(
    (manuale = false) => {
      const g = nodo.current;
      if (!g) return;
      const { k, x, y } = cam.current;
      g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})`);
      // solo il trascinamento a dito o rotella sospende i dettagli: durante le
      // transizioni automatiche la carta deve restare leggibile
      if (manuale) segnalaMovimento();
    },
    [segnalaMovimento],
  );

  /** tiene la carta dentro margini ragionevoli, senza incollarla ai bordi */
  const limita = useCallback(
    (c: Camera): Camera => {
      const k = Math.min(MAX_K, Math.max(MIN_K, c.k));
      const margineX = viewBox.width * 0.45;
      const margineY = viewBox.height * 0.45;
      const minX = viewBox.x + viewBox.width - (viewBox.x + viewBox.width) * k - margineX;
      const maxX = viewBox.x - viewBox.x * k + margineX;
      const minY = viewBox.y + viewBox.height - (viewBox.y + viewBox.height) * k - margineY;
      const maxY = viewBox.y - viewBox.y * k + margineY;
      return {
        k,
        x: Math.min(maxX, Math.max(minX, c.x)),
        y: Math.min(maxY, Math.max(minY, c.y)),
      };
    },
    [viewBox],
  );

  const ferma = useCallback(() => {
    if (animazione.current) cancelAnimationFrame(animazione.current);
    animazione.current = 0;
  }, []);

  const posa = useCallback(
    (c: Camera, manuale = false) => {
      ferma();
      cam.current = limita(c);
      scrivi(manuale);
    },
    [ferma, limita, scrivi],
  );

  /** porta la telecamera alla posizione indicata con una transizione morbida */
  const muovi = useCallback(
    (destinazione: Camera, durata = 520) => {
      const meta = limita(destinazione);
      if (ridottaAnimazione || durata <= 0) {
        posa(meta);
        return;
      }
      ferma();
      const partenza = { ...cam.current };
      const inizio = performance.now();
      const passo = (ora: number) => {
        const t = Math.min(1, (ora - inizio) / durata);
        const e = easeInOutCubic(t);
        cam.current = {
          k: partenza.k + (meta.k - partenza.k) * e,
          x: partenza.x + (meta.x - partenza.x) * e,
          y: partenza.y + (meta.y - partenza.y) * e,
        };
        scrivi();
        if (t < 1) animazione.current = requestAnimationFrame(passo);
        else animazione.current = 0;
      };
      animazione.current = requestAnimationFrame(passo);
    },
    [ferma, limita, posa, ridottaAnimazione, scrivi],
  );

  /** scala dell'SVG sullo schermo (viewBox -> pixel) */
  const scalaSchermo = useCallback(() => {
    const el = svg.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 1;
    return Math.min(r.width / viewBox.width, r.height / viewBox.height);
  }, [viewBox]);

  /** da coordinate di pagina a coordinate utente dell'SVG */
  const versoUtente = useCallback(
    (clientX: number, clientY: number) => {
      const el = svg.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const s = scalaSchermo();
      return {
        x: viewBox.x + (clientX - r.left - (r.width - viewBox.width * s) / 2) / s,
        y: viewBox.y + (clientY - r.top - (r.height - viewBox.height * s) / 2) / s,
      };
    },
    [scalaSchermo, viewBox],
  );

  /** zoom mantenendo fermo il punto indicato */
  const zoomSu = useCallback(
    (clientX: number, clientY: number, fattore: number) => {
      const u = versoUtente(clientX, clientY);
      const c = cam.current;
      const k = Math.min(MAX_K, Math.max(MIN_K, c.k * fattore));
      const rapporto = k / c.k;
      posa({ k, x: u.x - (u.x - c.x) * rapporto, y: u.y - (u.y - c.y) * rapporto }, true);
    },
    [posa, versoUtente],
  );

  /** zoom sul centro dello schermo, con transizione */
  const zoomCentro = useCallback(
    (fattore: number) => {
      const c = cam.current;
      const cx = viewBox.x + viewBox.width / 2;
      const cy = viewBox.y + viewBox.height / 2;
      const k = Math.min(MAX_K, Math.max(MIN_K, c.k * fattore));
      const rapporto = k / c.k;
      muovi({ k, x: cx - (cx - c.x) * rapporto, y: cy - (cy - c.y) * rapporto }, 260);
    },
    [muovi, viewBox],
  );

  const trascina = useCallback(
    (dxSchermo: number, dySchermo: number) => {
      const s = scalaSchermo();
      const c = cam.current;
      posa({ k: c.k, x: c.x + dxSchermo / s, y: c.y + dySchermo / s }, true);
    },
    [posa, scalaSchermo],
  );

  /** inquadra l'intera carta */
  const inquadraTutto = useCallback(
    (durata = 520) => {
      const el = svg.current;
      let k = 1;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) {
          // su schermi stretti e alti la carta intera sarebbe minuscola:
          // si avvicina quel tanto che basta a riempire lo spazio
          const rapporto = viewBox.width / viewBox.height / (r.width / r.height);
          if (rapporto > 1.2) k = Math.min(rapporto, 2.6);
        }
      }
      const cx = viewBox.x + viewBox.width / 2;
      const cy = viewBox.y + viewBox.height / 2;
      muovi({ k, x: cx - cx * k, y: cy - cy * k }, durata);
    },
    [muovi, viewBox],
  );

  /** inquadra un insieme di punti, avvicinandosi quanto serve */
  const inquadra = useCallback(
    (punti: { x: number; y: number }[], margine = 560, durata = 700) => {
      if (!punti.length) return;
      const xs = punti.map((p) => p.x);
      const ys = punti.map((p) => p.y);
      const larghezza = Math.max(...xs) - Math.min(...xs) + margine * 2;
      const altezza = Math.max(...ys) - Math.min(...ys) + margine * 2;
      const k = Math.min(1.6, Math.max(1, Math.min(viewBox.width / larghezza, viewBox.height / altezza)));
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      muovi(
        {
          k,
          x: viewBox.x + viewBox.width / 2 - cx * k,
          y: viewBox.y + viewBox.height / 2 - cy * k,
        },
        durata,
      );
    },
    [muovi, viewBox],
  );

  useEffect(
    () => () => {
      ferma();
      window.clearTimeout(quiete.current);
    },
    [ferma],
  );

  // identita' stabile: se cambiasse a ogni render, gli effetti che dipendono
  // dalla telecamera si riavvierebbero di continuo
  return useMemo(
    () => ({
      nodo,
      svg,
      cam,
      posa,
      muovi,
      zoomSu,
      zoomCentro,
      trascina,
      inquadra,
      inquadraTutto,
      versoUtente,
      scrivi,
    }),
    [posa, muovi, zoomSu, zoomCentro, trascina, inquadra, inquadraTutto, versoUtente, scrivi],
  );
}

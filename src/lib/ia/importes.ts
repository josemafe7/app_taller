// Detección de importes en textos de la IA: la IA nunca pone precios por su
// cuenta; los importes salen de la tarifa o de la ficha.

import type { Orden, ServicioTarifa } from '../tipos';
import { totalOrden } from '../calculos';

const RE_IMPORTE = /(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:€|euros?\b|eur\b)/gi;

/** Importes (en céntimos) que aparecen en un texto. */
export function importesEn(texto: string): number[] {
  return [...texto.matchAll(RE_IMPORTE)].map((m) => {
    const enteros = Number(m[1].replace(/\./g, ''));
    const dec = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
    return enteros * 100 + dec;
  });
}

export function tieneImportes(texto: string): boolean {
  return importesEn(texto).length > 0;
}

const cent = (euros: number) => Math.round(euros * 100);

/** Importes que el asistente puede decir: los de la tarifa (y sumas sencillas) y los de la orden verificada. */
export function importesPermitidos(tarifa: ServicioTarifa[], orden?: Pick<Orden, 'trabajos'>): Set<number> {
  const ok = new Set<number>();
  const precios = tarifa.map((s) => s.precio);
  for (const p of precios) for (let k = 1; k <= 10; k++) ok.add(cent(p * k));
  for (let i = 0; i < precios.length; i++) {
    for (let j = i + 1; j < precios.length; j++) {
      ok.add(cent(precios[i] + precios[j]));
      for (let k = j + 1; k < precios.length; k++) ok.add(cent(precios[i] + precios[j] + precios[k]));
    }
  }
  if (orden) {
    for (const t of orden.trabajos) if (t.precio !== null) ok.add(cent(t.precio));
    ok.add(cent(totalOrden(orden)));
  }
  return ok;
}

export function importesNoPermitidos(texto: string, permitidos: Set<number>): number[] {
  return importesEn(texto).filter((c) => !permitidos.has(c));
}

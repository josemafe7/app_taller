/** 1234.5 → "1.234,50 €" */
export function eur(n: number): string {
  const redondeado = Math.round((Number(n) || 0) * 100) / 100;
  const negativo = redondeado < 0;
  const [entera, dec] = Math.abs(redondeado).toFixed(2).split('.');
  return `${negativo ? '-' : ''}${entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
}

/** 84120 → "84.120 km" */
export function fkm(n: number): string {
  return `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
}

/** Lee importes o números escritos a la española: "1.234,50", "89", "89,5", "84.300". */
export function aNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let s = valor.replace(/\s|€|km/gi, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Precio como texto editable: 89 → "89", 89.5 → "89,50" */
export function precioEditable(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

export function iniciales(nombre: string): string {
  return nombre
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const LETRAS_MATRICULA = 'BCDFGHJKLMNPRSTVWXYZ';

/** "4821klm" → "4821 KLM". Si no sigue el formato actual, se deja en mayúsculas. */
export function formatearMatricula(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[\s-]/g, '');
  const m = limpio.match(/^(\d{4})([A-Z]{3})$/);
  if (m) return `${m[1]} ${m[2]}`;
  return valor.toUpperCase().trim().replace(/\s+/g, ' ');
}

export function claveMatricula(valor: string): string {
  return valor.toUpperCase().replace(/[\s-]/g, '');
}

/** Busca matrículas españolas (formato actual) dentro de un texto. */
export function matriculasEn(texto: string): string[] {
  const re = new RegExp(`\\b(\\d{4})\\s*-?\\s*([${LETRAS_MATRICULA}]{3})\\b`, 'gi');
  return [...texto.matchAll(re)].map((m) => `${m[1]} ${m[2].toUpperCase()}`);
}

/** Busca códigos de orden (OT-1041, ot 1041…) dentro de un texto. */
export function codigosOrdenEn(texto: string): string[] {
  return [...texto.matchAll(/\bOT\s*-?\s*(\d{3,5})\b/gi)].map((m) => `OT-${m[1]}`);
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/** "Juan García Pérez" → "Juan García"; "Reformas Hidalgo S.L." → "Reformas Hidalgo". */
export function nombreCortoDe(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  const sinSociedad = limpio.replace(/,?\s+(S\.?\s?L\.?\s?U\.?|S\.?\s?L\.?|S\.?\s?A\.?|S\.?\s?C\.?)$/i, '').trim();
  if (sinSociedad !== limpio) return sinSociedad || limpio;
  const palabras = limpio.split(' ');
  const corto: string[] = [];
  let fuertes = 0;
  for (const p of palabras) {
    corto.push(p);
    if (!PARTICULAS.has(p.toLowerCase())) fuertes++;
    if (fuertes === 2) break;
  }
  return corto.join(' ') || limpio;
}

export function primerNombre(nombre: string): string {
  return nombre.split(/\s+/)[0] ?? nombre;
}

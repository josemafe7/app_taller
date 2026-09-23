// Fechas siempre en hora de Madrid, sin depender de la zona horaria del servidor.

const TZ = 'Europe/Madrid';

const formateador = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

interface Partes { y: number; m: number; d: number; hh: number; mm: number }

export function partes(fecha: Date | string): Partes {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const p: Record<string, string> = {};
  for (const x of formateador.formatToParts(d)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Día (AAAA-MM-DD) en Madrid de un instante. */
export function diaDe(fecha: Date | string): string {
  const p = partes(fecha);
  return `${p.y}-${dos(p.m)}-${dos(p.d)}`;
}

export function hoy(): string {
  return diaDe(new Date());
}

export function horaDe(fecha: Date | string): string {
  const p = partes(fecha);
  return `${dos(p.hh)}:${dos(p.mm)}`;
}

function aUTC(dia: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function deUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(dia: string): number {
  return aUTC(dia).getUTCDay();
}

export function esLaborable(dia: string): boolean {
  const w = diaSemana(dia);
  return w >= 1 && w <= 5;
}

export function sumarDias(dia: string, n: number): string {
  const d = aUTC(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return deUTC(d);
}

/** Avanza (o retrocede, con n negativo) n días laborables. */
export function sumarLaborables(dia: string, n: number): string {
  let actual = dia;
  const paso = n < 0 ? -1 : 1;
  let quedan = Math.abs(n);
  while (quedan > 0) {
    actual = sumarDias(actual, paso);
    if (esLaborable(actual)) quedan--;
  }
  return actual;
}

export function lunesDe(dia: string): string {
  const w = diaSemana(dia);
  return sumarDias(dia, w === 0 ? -6 : 1 - w);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta).getTime() - aUTC(desde).getTime()) / 86_400_000);
}

/** Instante correspondiente a un día y una hora de Madrid. */
export function instante(dia: string, hm: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, hh, mm);
  const p = partes(new Date(supuesto));
  const comoUTC = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return new Date(supuesto - (comoUTC - supuesto));
}

// ——— Formatos para mostrar ———

/** "Lun 21 · 11:10" si es de estos días; "14 jul · 11:10" si es más antiguo. */
export function fmtSello(iso: string): string {
  const dia = diaDe(iso);
  const dif = diasEntre(dia, hoy());
  const [, m, d] = dia.split('-').map(Number);
  const cabeza = dif >= 0 && dif < 7 ? `${DIAS_CORTOS[diaSemana(dia)]} ${d}` : `${d} ${MESES_CORTOS[m - 1]}`;
  return `${cabeza} · ${horaDe(iso)}`;
}

/** "14 sep 2026" */
export function fmtFecha(isoODia: string): string {
  const dia = isoODia.length > 10 ? diaDe(isoODia) : isoODia;
  const [y, m, d] = dia.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** "23/09/2026" */
export function fmtFechaNumerica(isoODia: string): string {
  const dia = isoODia.length > 10 ? diaDe(isoODia) : isoODia;
  const [y, m, d] = dia.split('-');
  return `${d}/${m}/${y}`;
}

/** "jueves 24 de septiembre" */
export function fmtDiaLargo(dia: string): string {
  const [, m, d] = dia.split('-').map(Number);
  return `${DIAS[diaSemana(dia)]} ${d} de ${MESES[m - 1]}`;
}

/** "jueves 24" */
export function fmtDiaMedio(dia: string): string {
  const [, , d] = dia.split('-').map(Number);
  return `${DIAS[diaSemana(dia)]} ${d}`;
}

/** "24 sep" */
export function fmtDiaCorto(dia: string): string {
  const [, m, d] = dia.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** "Miércoles, 23 de septiembre de 2026" */
export function fmtCabecera(dia = hoy()): string {
  const [y, m, d] = dia.split('-').map(Number);
  const nombre = DIAS[diaSemana(dia)];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)}, ${d} de ${MESES[m - 1]} de ${y}`;
}

/** "Semana del 21 al 25 de septiembre" */
export function fmtSemana(lunes: string): string {
  const viernes = sumarDias(lunes, 4);
  const [, m1, d1] = lunes.split('-').map(Number);
  const [, m2, d2] = viernes.split('-').map(Number);
  if (m1 === m2) return `Semana del ${d1} al ${d2} de ${MESES[m2 - 1]}`;
  return `Semana del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

/** Hora en la lista de conversaciones: "10:42", "Ayer", "Lun 21", "14 sep". */
export function fmtLista(iso: string): string {
  const dif = diasEntre(diaDe(iso), hoy());
  if (dif <= 0) return horaDe(iso);
  if (dif === 1) return 'Ayer';
  const dia = diaDe(iso);
  if (dif < 7) return `${DIAS_CORTOS[diaSemana(dia)]} ${Number(dia.slice(8))}`;
  return fmtDiaCorto(dia);
}

/** Hora de un mensaje: "10:42", "Ayer · 18:02", "Lun 21 · 18:02". */
export function fmtMensaje(iso: string): string {
  const dif = diasEntre(diaDe(iso), hoy());
  if (dif <= 0) return horaDe(iso);
  if (dif === 1) return `Ayer · ${horaDe(iso)}`;
  return fmtSello(iso);
}

export function diasEnTaller(entradaIso: string): number {
  return Math.max(0, diasEntre(diaDe(entradaIso), hoy()));
}

export function etiquetaDias(n: number): string {
  if (n <= 0) return 'Entró hoy';
  return n === 1 ? '1 día' : `${n} días`;
}

export function saludo(): string {
  const h = partes(new Date()).hh;
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "8:30" a partir de "08:30" */
export function horaCorta(hm: string): string {
  return hm.replace(/^0/, '');
}

// Piezas visuales del diseño: matrícula, estado, iniciales, números.

import type { ReactNode } from 'react';
import { ESTADOS } from '@/lib/constantes';
import type { EstadoOrden, EstadoPieza } from '@/lib/tipos';
import { ESTADOS_PIEZA } from '@/lib/constantes';

const TAM_MATRICULA = {
  xs: { h: 24, f: 14, b: 1.5, r: 4, px: 7 },
  sm: { h: 30, f: 18, b: 2, r: 5, px: 9 },
  md: { h: 32, f: 20, b: 2, r: 5, px: 10 },
  lg: { h: 36, f: 22, b: 2, r: 5, px: 12 },
  movil: { h: 38, f: 24, b: 2, r: 5, px: 12 },
  xlm: { h: 46, f: 30, b: 2.5, r: 6, px: 14 },
  xl: { h: 48, f: 30, b: 2.5, r: 6, px: 16 },
};

export function Matricula({ valor, tam = 'md', className = '' }: { valor: string; tam?: keyof typeof TAM_MATRICULA; className?: string }) {
  const t = TAM_MATRICULA[tam];
  return (
    <span
      className={`inline-flex items-center bg-white font-mono font-bold tracking-[.03em] whitespace-nowrap text-tinta ${className}`}
      style={{ height: t.h, fontSize: t.f, border: `${t.b}px solid #1C1917`, borderRadius: t.r, padding: `0 ${t.px}px` }}
    >
      {valor}
    </span>
  );
}

const TAM_PILL = {
  sm: { f: 12, p: '3px 10px', d: 7 },
  md: { f: 13, p: '3px 10px', d: 8 },
  movil: { f: 13, p: '4px 11px', d: 8 },
  lg: { f: 14, p: '4px 11px', d: 8 },
};

export function EstadoPill({ estado, tam = 'md', fuerte = false }: { estado: EstadoOrden; tam?: keyof typeof TAM_PILL; fuerte?: boolean }) {
  const e = ESTADOS[estado];
  const s = TAM_PILL[tam];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full whitespace-nowrap"
      style={{
        background: e.bg, color: e.c, border: fuerte ? `1.5px solid ${e.c}` : `1px solid ${e.bd}`,
        fontSize: s.f, padding: s.p, fontWeight: fuerte ? 700 : 600,
      }}
    >
      <span className="rounded-full shrink-0" style={{ width: s.d, height: s.d, background: e.c }} />
      {e.nombre}
    </span>
  );
}

export function colorPieza(estado: EstadoPieza, nota?: string) {
  if (/retraso/i.test(nota ?? '')) return { c: '#B91C1C', bg: '#FEF2F2' };
  if (estado === 'recibida' || estado === 'stock') return { c: '#15803D', bg: '#F0FDF4' };
  return { c: '#B45309', bg: '#FFFBEB' };
}

export function EstadoPiezaChip({ estado, nota }: { estado: EstadoPieza; nota?: string }) {
  const col = colorPieza(estado, nota);
  return (
    <span className="text-[13px] font-semibold rounded px-2 py-0.5" style={{ color: col.c, background: col.bg }}>
      {ESTADOS_PIEZA[estado]}{nota ? ` · ${nota}` : ''}
    </span>
  );
}

export function Iniciales({ texto, tam = 22 }: { texto: string; tam?: number }) {
  return (
    <span
      className="rounded-full bg-tinta text-white font-bold flex items-center justify-center shrink-0"
      style={{ width: tam, height: tam, fontSize: Math.round(tam / 2) }}
    >
      {texto}
    </span>
  );
}

export function Numero({ n }: { n: number }) {
  return (
    <span className="w-[18px] h-[18px] rounded-full bg-rojo text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

export function TituloSeccion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`titulo-seccion ${className}`}>{children}</h2>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="text-sm text-t4 py-2.5 border-t border-linea">{children}</div>;
}

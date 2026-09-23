'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { VistaId } from '@/lib/tipos';

const SECCIONES: { id: VistaId; ruta: string; nombre: string }[] = [
  { id: 'tablero', ruta: '/tablero', nombre: 'Tablero' },
  { id: 'conversaciones', ruta: '/conversaciones', nombre: 'Conversaciones' },
  { id: 'clientes', ruta: '/clientes', nombre: 'Clientes' },
  { id: 'citas', ruta: '/citas', nombre: 'Citas' },
  { id: 'tarifa', ruta: '/tarifa', nombre: 'Tarifa' },
  { id: 'probar', ruta: '/probar-asistente', nombre: 'Probar asistente' },
];

export function Navegacion({ vistas, pendientes, fecha, iaLista }: {
  vistas: VistaId[]; pendientes: number; fecha: string; iaLista: boolean;
}) {
  const ruta = usePathname();
  const activa = ruta.startsWith('/ordenes') ? '/tablero' : SECCIONES.find((s) => ruta.startsWith(s.ruta))?.ruta;

  return (
    <nav className="no-imprimir bg-white border-b border-borde px-4 sm:px-7 flex gap-1 items-center overflow-x-auto">
      {SECCIONES.filter((s) => vistas.includes(s.id)).map((s) => {
        const on = s.ruta === activa;
        return (
          <Link
            key={s.id}
            href={s.ruta}
            className="border-b-[3px] px-3.5 pt-3.5 pb-[11px] text-[15px] font-semibold flex items-center gap-2 whitespace-nowrap"
            style={{ borderBottomColor: on ? '#B91C1C' : 'transparent', color: on ? '#1C1917' : '#57534E' }}
          >
            {s.nombre}
            {s.id === 'conversaciones' && pendientes > 0 && (
              <span className="bg-rojo text-white text-xs font-bold rounded-full px-[7px] py-px">{pendientes}</span>
            )}
          </Link>
        );
      })}
      <span className="ml-auto flex items-center gap-3 pl-4 whitespace-nowrap">
        {!iaLista && (
          <span
            title="Pon la clave de OpenRouter en .env.local y reinicia la app. Mientras tanto, todo se puede hacer a mano."
            className="text-xs font-semibold text-rojo bg-rojo-50 border border-rojo-200 rounded px-2 py-0.5"
          >
            IA sin configurar
          </span>
        )}
        <span className="text-[13px] text-t2">{fecha}</span>
      </span>
    </nav>
  );
}

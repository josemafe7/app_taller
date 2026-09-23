import Link from 'next/link';
import { cerrarSesion } from '@/app/acceso';
import type { Persona } from '@/lib/tipos';

// Arriba a la derecha: quién ha entrado (lleva a cambiar la contraseña) y el botón para salir.
export function Cabecera({ persona }: { persona: Persona }) {
  return (
    <header className="no-imprimir bg-white border-b border-borde px-4 sm:px-7 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <Link href="/" className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-rojo rounded-md text-white font-bold text-base flex items-center justify-center shrink-0">TR</div>
        <div className="min-w-0">
          <div className="font-bold text-[17px] leading-[1.15]">Talleres Ruiz</div>
          <div className="text-xs text-t2 hidden sm:block">Mecánica y electricidad del automóvil · Getafe</div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/cuenta"
          className="flex flex-col items-start px-3 py-[5px] rounded-lg bg-tinta text-white leading-[1.2] hover:opacity-90"
          title={`${persona.nombreCompleto} · cambiar contraseña`}
        >
          <span className="text-sm font-semibold">{persona.nombre}</span>
          <span className="text-[11px] text-t6">{persona.rolEtiqueta} · Contraseña</span>
        </Link>
        <form action={cerrarSesion}>
          <button type="submit" className="btn btn-borde h-[42px] px-3.5 text-sm">Salir</button>
        </form>
      </div>
    </header>
  );
}

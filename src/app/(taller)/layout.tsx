import type { Metadata } from 'next';
import { Cabecera } from '@/components/cabecera';
import { Navegacion } from '@/components/navegacion';
import { AutoRefresco } from '@/components/auto-refresco';
import { dbSesion, personaObligatoria } from '@/lib/sesion';
import { vistasDe } from '@/lib/permisos';
import { pendientesDePersona } from '@/lib/datos';
import { fmtCabecera } from '@/lib/fechas';
import { iaConfigurada } from '@/lib/ia/openrouter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LayoutTaller({ children }: { children: React.ReactNode }) {
  const yo = await personaObligatoria();
  const pendientes = yo.rol === 'mecanico' ? 0 : await pendientesDePersona(await dbSesion());
  return (
    <div className="min-h-dvh flex flex-col has-[.pantalla-completa]:h-dvh">
      <Cabecera persona={yo} />
      {yo.rol !== 'mecanico' && (
        <Navegacion vistas={vistasDe(yo)} pendientes={pendientes} fecha={fmtCabecera()} iaLista={iaConfigurada()} />
      )}
      {children}
      <AutoRefresco />
    </div>
  );
}

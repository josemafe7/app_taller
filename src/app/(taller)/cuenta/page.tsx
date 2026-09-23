import Link from 'next/link';
import { personaObligatoria } from '@/lib/sesion';
import { inicioDe } from '@/lib/permisos';
import { PERSONAS } from '@/lib/constantes';
import { FormClaveEquipo, FormMiClave } from '@/components/cuenta';

export const dynamic = 'force-dynamic';

export default async function PaginaCuenta() {
  const yo = await personaObligatoria();
  const otros = PERSONAS.filter((p) => p.id !== yo.id).map((p) => ({ id: p.id, nombre: `${p.nombreCompleto} (${p.rolEtiqueta.toLowerCase()})` }));
  return (
    <main className="px-4 sm:px-7 pt-5 pb-12 flex flex-col gap-4 max-w-[560px] w-full mx-auto">
      <Link href={inicioDe(yo)} className="self-start text-t2 text-sm font-semibold py-1 hover:text-tinta">‹ Volver</Link>
      <div>
        <h1 className="m-0 text-[26px] font-bold">Contraseña</h1>
        <div className="text-t2 text-sm mt-1">Entras como <b className="text-tinta">{yo.nombreCompleto}</b> (usuario «{yo.id}»).</div>
      </div>
      <FormMiClave />
      {yo.rol === 'dueno' && <FormClaveEquipo personas={otros} />}
    </main>
  );
}

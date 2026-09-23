import { redirect } from 'next/navigation';
import { personaObligatoria } from '@/lib/sesion';
import { inicioDe } from '@/lib/permisos';

export const dynamic = 'force-dynamic';

// Vista del mecánico: pensada para el móvil. En pantallas grandes se queda
// en una columna centrada.
export default async function LayoutMovil({ children }: { children: React.ReactNode }) {
  const yo = await personaObligatoria();
  if (yo.rol !== 'mecanico') redirect(inicioDe(yo));
  return <main className="flex-1 w-full max-w-[520px] mx-auto">{children}</main>;
}

import { redirect } from 'next/navigation';
import { personaActual } from '@/lib/sesion';
import { inicioDe } from '@/lib/permisos';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const yo = await personaActual();
  redirect(yo ? inicioDe(yo) : '/entrar');
}

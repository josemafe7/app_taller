import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { personaActual } from '@/lib/sesion';
import { supabaseConfigurado } from '@/lib/supabase/servidor';
import { inicioDe } from '@/lib/permisos';
import { FormEntrar } from '@/components/entrar';

export const metadata: Metadata = {
  title: 'Entrar · Talleres Ruiz',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PaginaEntrar() {
  const yo = await personaActual();
  if (yo) redirect(inicioDe(yo));

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rojo rounded-md text-white font-bold text-lg flex items-center justify-center shrink-0">TR</div>
          <div>
            <div className="font-bold text-xl leading-tight">Talleres Ruiz</div>
            <div className="text-[13px] text-t2">Mecánica y electricidad del automóvil · Getafe</div>
          </div>
        </div>

        {supabaseConfigurado() ? (
          <FormEntrar />
        ) : (
          <div className="tarjeta p-6 flex flex-col gap-2 text-[15px] leading-normal">
            <h1 className="m-0 text-xl font-bold">Falta conectar la base de datos</h1>
            <p className="m-0 text-t3">
              Pon <b className="font-mono">SUPABASE_URL</b> y <b className="font-mono">SUPABASE_PUBLISHABLE_KEY</b> en
              <b className="font-mono"> .env.local</b> (mira <b className="font-mono">.env.local.example</b>) y reinicia la app.
            </p>
          </div>
        )}

        <p className="m-0 text-sm text-t2 text-center">
          ¿Eres cliente?{' '}
          <Link href="/chat" className="text-rojo font-semibold hover:underline">Pregúntanos por tu coche o pide cita</Link>
        </p>
      </div>
    </main>
  );
}

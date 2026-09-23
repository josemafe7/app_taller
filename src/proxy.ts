// Antes de cada página: si la sesión de Supabase está a punto de caducar, la
// renueva y guarda las cookies nuevas (las páginas no pueden escribir cookies).
// No decide quién entra: eso lo comprueban las páginas y la base de datos.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { datosSupabase, esHttps, opcionesCookie } from '@/lib/supabase/cookies';

export async function proxy(request: NextRequest) {
  const supabase = datosSupabase();
  const conSesion = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (!supabase || !conSesion) return NextResponse.next({ request });

  let respuesta = NextResponse.next({ request });
  const cliente = createServerClient(supabase.url, supabase.clave, {
    cookieOptions: opcionesCookie(esHttps(request.headers, request.nextUrl.protocol)),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, cabeceras) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
        for (const [clave, valor] of Object.entries(cabeceras ?? {})) respuesta.headers.set(clave, valor);
      },
    },
  });
  // Comprueba el token y, si hace falta, lo renueva.
  await cliente.auth.getClaims();
  return respuesta;
}

export const config = {
  // Fuera: archivos estáticos y el chat público (no usa sesión).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|chat|api/chat).*)'],
};

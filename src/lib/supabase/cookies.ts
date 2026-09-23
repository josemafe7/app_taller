// Opciones de las cookies de sesión de Supabase. La app solo usa Supabase
// desde el servidor, así que el navegador no necesita leerlas (httpOnly).

export function esHttps(cabeceras: Headers, protocolo?: string): boolean {
  const reenviado = (cabeceras.get('x-forwarded-proto') ?? '').split(',')[0].trim();
  return reenviado ? reenviado === 'https' : protocolo === 'https:';
}

export function opcionesCookie(https: boolean) {
  return { httpOnly: true, secure: https, sameSite: 'lax' as const, path: '/' };
}

export function datosSupabase(): { url: string; clave: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && clave ? { url, clave } : null;
}

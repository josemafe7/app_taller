'use client';

// Refresca los datos del servidor cada pocos segundos en las pantallas que
// cambian solas (mensajes nuevos, cambios de otros compañeros).

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function intervalo(ruta: string): number | null {
  if (ruta.startsWith('/conversaciones')) return 3000;
  if (ruta === '/tablero' || ruta === '/citas' || ruta === '/movil') return 10000;
  return null;
}

export function AutoRefresco() {
  const router = useRouter();
  const ruta = usePathname();
  useEffect(() => {
    const ms = intervalo(ruta);
    if (!ms) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [ruta, router]);
  return null;
}

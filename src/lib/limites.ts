// Límites de intentos (en memoria): contraseñas probadas a lo loco y
// mensajes en masa al chat público, que cuestan dinero en la IA.

declare global {
  var __trLimites: Map<string, number[]> | undefined;
}

const registro = (): Map<string, number[]> => (globalThis.__trLimites ??= new Map<string, number[]>());

function recientes(clave: string, ventanaMs: number): number[] {
  const ahora = Date.now();
  const lista = (registro().get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  registro().set(clave, lista);
  return lista;
}

/** ¿Quedan intentos? No apunta nada. */
export function quedan(clave: string, maximo: number, ventanaMs: number): boolean {
  return recientes(clave, ventanaMs).length < maximo;
}

export function apuntar(clave: string): void {
  const mapa = registro();
  mapa.set(clave, [...(mapa.get(clave) ?? []), Date.now()]);
  if (mapa.size > 5000) {
    const hace = Date.now() - 24 * 3600_000;
    for (const [k, v] of mapa) if (!v.some((t) => t > hace)) mapa.delete(k);
  }
}

/** Comprueba y, si queda hueco, lo apunta. */
export function consumir(clave: string, maximo: number, ventanaMs: number): boolean {
  if (!quedan(clave, maximo, ventanaMs)) return false;
  apuntar(clave);
  return true;
}

export function olvidar(clave: string): void {
  registro().delete(clave);
}

/** IP de quien pide. Detrás de un proxy, la última que ha añadido el proxy. */
export function ipDe(h: Headers): string {
  const reenviada = h.get('x-forwarded-for');
  if (reenviada) {
    const partes = reenviada.split(',').map((s) => s.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return h.get('x-real-ip') ?? 'desconocida';
}

// Errores que se enseñan tal cual a quien usa la app, y traducción de los
// errores de la base de datos a mensajes que se entienden.

export class ErrorNegocio extends Error {}

interface ErrorBd {
  code?: string;
  message: string;
  details?: string | null;
}

/** Mensaje para cada restricción de la base de datos que puede saltar al usar la app. */
const RESTRICCIONES: Record<string, string> = {
  citas_hueco_unico: 'Ese hueco ya está cogido.',
  coches_matricula_unica: 'Esa matrícula ya está dada de alta.',
  ordenes_una_abierta_por_coche: 'Ese coche ya tiene una orden abierta.',
  clientes_pkey: 'Ese cliente ya existe. Vuelve a intentarlo.',
};

export function errorDeBd(e: ErrorBd, contexto: string): Error {
  const texto = `${e.message} ${e.details ?? ''}`;
  if (e.code === '23505' || e.code === '23503' || e.code === '23514') {
    for (const [nombre, mensaje] of Object.entries(RESTRICCIONES)) if (texto.includes(nombre)) return new ErrorNegocio(mensaje);
    if (e.code === '23503') return new ErrorNegocio('Falta un dato relacionado (puede que alguien lo haya cambiado). Recarga la página.');
    if (e.code === '23514') return new ErrorNegocio('Algún dato no es válido. Revísalo.');
    return new ErrorNegocio('Ese dato ya existe.');
  }
  if (e.code === '42501') {
    // Las reglas propias de la base de datos ya vienen en español.
    if (/row-level security|permission denied/i.test(e.message)) return new ErrorNegocio('Con este perfil no puedes hacer esto.');
    return new ErrorNegocio(e.message);
  }
  if (e.code === '22023') return new ErrorNegocio(e.message);
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || /JWT/i.test(e.message)) {
    return new ErrorNegocio('Tu sesión ha caducado. Vuelve a entrar.');
  }
  return new Error(`[${contexto}] ${e.code ?? ''} ${e.message}`);
}

/** Devuelve los datos (listas, .single(), .select() tras cambiar) o lanza el error traducido. */
export function datosO<X>(r: { data: X | null; error: ErrorBd | null }, contexto: string): X {
  if (r.error) throw errorDeBd(r.error, contexto);
  if (r.data === null) throw new Error(`[${contexto}] la base de datos no ha devuelto datos`);
  return r.data;
}

/** Para .maybeSingle(): la fila o null. */
export function quizas<X>(r: { data: X | null; error: ErrorBd | null }, contexto: string): X | null {
  if (r.error) throw errorDeBd(r.error, contexto);
  return r.data;
}

/** Para cambios sin respuesta (update/delete sin .select()). */
export function sinError(r: { error: ErrorBd | null }, contexto: string): void {
  if (r.error) throw errorDeBd(r.error, contexto);
}

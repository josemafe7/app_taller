// BORRA TODOS LOS DATOS de la base de datos y carga los datos de ejemplo.
// Solo puede hacerlo el dueño: pide su contraseña y una confirmación.
// Uso: npm run reset

import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { crearDatosEjemplo } from '../src/lib/datos-ejemplo';
import { datosParaCargar } from '../src/lib/filas';
import type { Database } from '../src/lib/supabase/tipos-bd';
import { leerLineas, valorDe } from './env.mjs';

function preguntar(texto: string, oculto = false): Promise<string> {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      // No enseña lo que se escribe (contraseña).
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(texto)) process.stdout.write(s);
      };
    }
    rl.question(texto, (respuesta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      resolver(respuesta);
    });
  });
}

async function principal() {
  const lineas = leerLineas() as string[];
  const url = process.env.SUPABASE_URL || valorDe(lineas, 'SUPABASE_URL');
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY || valorDe(lineas, 'SUPABASE_PUBLISHABLE_KEY');
  if (!url || !clave) {
    console.error('Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en .env.local.');
    process.exit(1);
  }

  console.log('\nATENCIÓN: esto BORRA todos los clientes, coches, órdenes, citas y conversaciones de la base de datos');
  console.log('y carga los datos de ejemplo. No se puede deshacer.\n');
  const confirmacion = await preguntar('Para seguir, escribe BORRAR TODO: ');
  if (confirmacion.trim() !== 'BORRAR TODO') {
    console.log('No se ha borrado nada.');
    return;
  }
  const contrasena = await preguntar('Contraseña de Paco (dueño): ', true);

  const db = createClient<Database>(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: errorEntrar } = await db.auth.signInWithPassword({ email: 'paco@taller.invalid', password: contrasena });
  if (errorEntrar) {
    console.error('Contraseña incorrecta. No se ha borrado nada.');
    process.exitCode = 1;
    return;
  }
  const { error } = await db.rpc('reiniciar_datos', { p_datos: datosParaCargar(crearDatosEjemplo()) });
  await db.auth.signOut({ scope: 'local' });
  if (error) {
    console.error(`No se han podido cargar los datos: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log('✔ Datos de ejemplo cargados. Recarga la app en el navegador.');
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

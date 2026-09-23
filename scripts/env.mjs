// Lectura y escritura sencilla de .env.local (líneas NOMBRE=valor).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const RUTA_ENV = new URL('../.env.local', import.meta.url);

export function leerLineas() {
  return existsSync(RUTA_ENV) ? readFileSync(RUTA_ENV, 'utf8').split(/\r?\n/) : [];
}

const patron = (nombre) => new RegExp(`^\\s*${nombre}\\s*=`);

export function valorDe(lineas, nombre) {
  const linea = lineas.find((l) => patron(nombre).test(l));
  if (!linea) return undefined;
  return linea.slice(linea.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

export function ponerValor(lineas, nombre, valor) {
  const i = lineas.findIndex((l) => patron(nombre).test(l));
  if (i >= 0) lineas[i] = `${nombre}=${valor}`;
  else lineas.push(`${nombre}=${valor}`);
}

export function guardarLineas(lineas) {
  writeFileSync(RUTA_ENV, `${lineas.join('\n').replace(/\n+$/, '')}\n`);
}

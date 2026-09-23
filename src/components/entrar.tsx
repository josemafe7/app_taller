'use client';

import { useActionState } from 'react';
import { iniciarSesion, type EstadoEntrar } from '@/app/acceso';

export function FormEntrar() {
  const [estado, accion, pendiente] = useActionState<EstadoEntrar, FormData>(iniciarSesion, { error: '', usuario: '' });
  return (
    <form action={accion} className="tarjeta p-6 flex flex-col gap-4">
      <h1 className="m-0 text-2xl font-bold">Entrar</h1>
      <label className="etiqueta">
        Usuario
        <input
          name="usuario"
          defaultValue={estado.usuario}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="Por ejemplo: lucia"
          className="campo h-12 text-base"
        />
      </label>
      <label className="etiqueta">
        Contraseña
        <input name="clave" type="password" autoComplete="current-password" required className="campo h-12 text-base" />
      </label>
      {estado.error && (
        <div role="alert" className="text-sm font-semibold text-rojo bg-rojo-50 border border-rojo-200 rounded-lg px-3 py-2">
          {estado.error}
        </div>
      )}
      <button type="submit" disabled={pendiente} className="btn btn-rojo h-12 text-base">
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

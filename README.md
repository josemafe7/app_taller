# Talleres Ruiz · app del taller

App web del taller (Next.js + TypeScript + Tailwind) según el diseño de Claude Design.
Los datos y los usuarios están en **Supabase** (proyecto «Taller»): los cambios se guardan y no se pierden al reiniciar.

## 1. Configuración

Todo va en `.env.local` (hay un modelo en `.env.local.example`). Lo usa solo el servidor: nunca llega al navegador.

- `OPENROUTER_API_KEY`: clave de OpenRouter para la IA.
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`: URL y clave publicable del proyecto de Supabase.
- `SUPABASE_ASISTENTE_CLAVE`: contraseña de la cuenta con la que la app atiende el chat público.

Reinicia la app después de cualquier cambio en `.env.local`.

Modelo de IA: `google/gemini-3-flash-preview` (el «Gemini 3 Flash» de OpenRouter). Acepta audio, así que también transcribe las notas de voz.
Sin clave (o si la IA falla) todo se puede hacer a mano.

## 2. Arrancar

Necesitas Node.js 20.9 o más reciente.

```bash
npm install
npm run build
npm start
```

Abre http://localhost:5678 y entra con tu usuario: `paco`, `lucia`, `javi`, `ruben` o `marta`.

| Usuario | Qué ve |
| --- | --- |
| paco (dueño) | Todo, también la tarifa y «Probar asistente» |
| lucia (recepción) | Tablero, conversaciones, clientes y citas |
| javi, ruben, marta (mecánicos) | Solo sus coches mientras están en el taller, en la vista de móvil |

**Contraseñas:** nadie puede cambiarlas desde la app (ni siquiera Paco). Solo se cambian desde la base de datos, en Supabase → SQL Editor:

```sql
select privado.poner_clave('lucia', 'una-contraseña-nueva-larga');
```

El primer dato es el usuario (`paco`, `lucia`, `javi`, `ruben` o `marta`); la contraseña, de 10 a 72 caracteres. A esa persona se le cierran las sesiones abiertas. Si cambias la de `asistente`, pon la nueva también en `SUPABASE_ASISTENTE_CLAVE` (en `.env.local` y en Vercel) o el chat público dejará de funcionar.

**Chat para clientes:** `/chat` (por ejemplo, http://localhost:5678/chat). Es público: es el enlace que se pone en la web del taller. Cada chat nuevo entra en Conversaciones con el canal «Web».

**Probar asistente** (solo Paco): una pestaña en la que Paco escribe como si fuera un cliente, con el mismo chat y la misma IA que `/chat`. Esos chats salen en Conversaciones con la etiqueta «Prueba», no avisan a recepción como pendientes y las citas que se reservan en ellos no se guardan.

## 3. Base de datos

- El esquema está en `supabase/migrations` (tablas, reglas de seguridad y funciones), aplicado ya en el proyecto «Taller».
- Cada orden guarda dentro sus trabajos, piezas, observaciones e historial. Un cambio en una orden se guarda de una vez (todo o nada) y, si dos personas la tocan a la vez, no se pisan.
- Los usuarios están en Supabase → Authentication. Cada uno lleva su persona y su rol en `app_metadata`. Las altas desde fuera están bloqueadas.

## 4. Seguridad

- La app solo habla con Supabase desde el servidor. La sesión va en cookies `HttpOnly` y se renueva sola.
- Cada consulta se hace con la sesión de quien la pide. La base de datos aplica sus propias reglas (RLS), aunque alguien se saltara la app:
  - Un mecánico solo ve y cambia sus coches mientras están en el taller. No puede cerrar órdenes ni pasárselas a otro.
  - Recepción no puede tocar la tarifa.
  - Nadie cambia contraseñas desde la app ni desde la API de Supabase Auth (tampoco recuperarlas por email): la base de datos lo bloquea. Solo desde el SQL Editor.
  - El historial de una orden solo crece: no se puede borrar ni cambiar.
  - No puede haber dos citas en el mismo hueco ni dos órdenes abiertas para el mismo coche.
- El chat público usa una cuenta propia (el «asistente»). No puede leer clientes, coches, órdenes ni citas. Solo recibe los datos de una orden si el cliente escribe su código y su matrícula y coinciden. Si alguien prueba muchos códigos, la conversación pasa a una persona.
- Límites: tras 10 intentos de entrar fallidos desde el mismo sitio (o 20 contra el mismo usuario) hay que esperar. El chat público limita los mensajes por conexión y el total de respuestas de la IA por hora, para que nadie gaste el saldo de OpenRouter.

## 5. Volver a los datos de ejemplo

**Cuidado: borra todos los datos reales.** Pide escribir `BORRAR TODO` y la contraseña de Paco:

```bash
npm run reset
```

## 6. Para usarla desde los móviles

- El dictado por voz necesita **https** (o `localhost`). Desde un móvil conectado por la IP de la red (`http://192.168...`) el micrófono no se puede usar; escribir sí.
- Para abrirla fuera del taller o con https, ponla detrás de un servidor con certificado (por ejemplo Caddy o un túnel de Cloudflare) que apunte al puerto 5678.

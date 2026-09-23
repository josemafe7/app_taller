import { exigirVista } from '@/lib/sesion';
import { ChatPublico } from '@/components/chat/chat-publico';

export const dynamic = 'force-dynamic';

const IDEAS = [
  '¿Cuánto cuesta cambiar el aceite?',
  'Quiero cita para pasar la revisión la semana que viene',
  '¿Cómo va mi coche? (dale el código de una orden del Tablero y su matrícula)',
  'Tengo un ruido al frenar, ¿qué puede ser?',
  'Quiero poner una reclamación',
];

// Solo el dueño: hace de cliente para ver cómo contesta el asistente.
export default async function PaginaProbarAsistente() {
  await exigirVista('probar');
  return (
    <main className="px-4 sm:px-7 pt-5 pb-10 flex flex-col lg:flex-row gap-6 items-start justify-center w-full">
      <ChatPublico prueba />
      <section className="w-full lg:max-w-[380px] flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold">Probar el asistente</h1>
          <p className="text-t2 text-[15px] leading-[1.5] mt-1.5 mb-0">
            Escribe como si fueras un cliente. Es el mismo chat que ven los clientes en la web, con la misma IA y las mismas reglas.
          </p>
        </div>
        <div className="bg-white border border-borde rounded-xl px-4 py-3.5 text-[14px] leading-[1.5] flex flex-col gap-2">
          <b>Qué pasa con estas pruebas</b>
          <span>· El chat sale en Conversaciones con la etiqueta <b>Prueba</b>. Ahí puedes contestar como el taller o devolvérselo a la IA.</span>
          <span>· Si pide una persona, no avisa a recepción: los chats de prueba no cuentan como pendientes.</span>
          <span>· Las citas que reserve el asistente aquí <b>no se guardan</b> en Citas.</span>
          <span>· Para ver cómo va una orden, el asistente pide el código de la orden y la matrícula, igual que a un cliente.</span>
          <span>· «Nuevo chat» empieza de cero, como un cliente nuevo.</span>
        </div>
        <div className="flex flex-col gap-2">
          <b className="text-[14px]">Ideas para probar</b>
          <ul className="m-0 pl-5 text-[14px] text-t2 leading-[1.6]">
            {IDEAS.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      </section>
    </main>
  );
}

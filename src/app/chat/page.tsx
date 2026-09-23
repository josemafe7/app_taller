import type { Metadata } from 'next';
import { ChatPublico } from '@/components/chat/chat-publico';

export const metadata: Metadata = {
  title: 'Chat · Talleres Ruiz',
  description: 'Pregunta por tu coche, pide precio o reserva cita en Talleres Ruiz (Getafe).',
};

// Página pública para clientes. Cada chat nuevo entra en la bandeja del
// taller con el canal "Web".
export default function PaginaChat() {
  return (
    <main className="min-h-dvh flex justify-center items-start sm:items-center sm:p-6">
      <ChatPublico />
    </main>
  );
}

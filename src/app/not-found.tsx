import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-12 h-12 bg-rojo rounded-md text-white font-bold text-lg flex items-center justify-center">TR</div>
      <h1 className="m-0 text-2xl font-bold">No encontramos esa página</h1>
      <p className="m-0 text-t2 text-[15px] max-w-[420px]">
        Puede que la orden, el cliente o la conversación ya no existan.
      </p>
      <Link href="/" className="btn btn-rojo h-10 px-5 text-sm">Volver al taller</Link>
    </main>
  );
}

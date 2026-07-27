export default function Home() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <div className="h-12 w-12 rounded-lg bg-stone-900 text-white grid place-items-center font-bold mx-auto mb-4">
          KO
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">KickOff Ordina</h1>
        <p className="text-stone-500 text-sm max-w-sm">
          Inquadra il QR code alla tua postazione (ombrellone, spogliatoio o
          tavolo) per aprire il menu e ordinare.
        </p>
      </div>
    </div>
  );
}

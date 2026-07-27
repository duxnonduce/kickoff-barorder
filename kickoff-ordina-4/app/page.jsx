export default function Home() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <div className="bg-stone-900 rounded-3xl px-10 py-8 mb-5 inline-block">
          <img src="/logo-square.png" alt="KickOff" className="h-40 w-auto mx-auto" />
        </div>
        <p className="text-stone-500 text-sm max-w-sm">
          Inquadra il QR code alla tua postazione (ombrellone, spogliatoio o
          tavolo) per aprire il menu e ordinare.
        </p>
      </div>
    </div>
  );
}

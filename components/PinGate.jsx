"use client";

import { useState } from "react";

// Gate minimo v1: chiede il PIN staff e lo tiene in memoria per la sessione
// (viene passato alle chiamate API che modificano dati). Da sostituire in
// una v2 con Supabase Auth + ruoli, sullo stesso modello di PointLab.
export default function PinGate({ onUnlock, label, role = "bar" }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pin.trim().length < 4) {
      setError(true);
      return;
    }
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.trim(), role }),
    });
    const { ok } = await res.json();
    if (!ok) {
      setError(true);
      return;
    }
    onUnlock(pin.trim());
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <img src="/logo-icon.png" alt="KickOff" className="h-14 w-auto mx-auto mb-4" />
        <h1 className="text-lg font-bold mb-1">{label}</h1>
        <p className="text-sm text-stone-500 mb-4">Inserisci il PIN dello staff</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          className={`w-full text-center text-lg tracking-widest border rounded-lg px-3 py-2 mb-3 ${error ? "border-rose-400" : "border-stone-300"}`}
          placeholder="••••"
        />
        {error && <div className="text-xs text-rose-600 mb-3">PIN non valido, riprova.</div>}
        <button className="w-full bg-stone-900 text-white text-sm font-semibold rounded-lg py-2.5">Entra</button>
      </form>
    </div>
  );
}

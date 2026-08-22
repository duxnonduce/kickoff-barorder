"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "kickoff_staff_";

// Chiede "Chi sei?" una volta per sessione del browser (sessionStorage,
// non localStorage: si azzera quando si chiude la scheda/il browser).
// Non è un secondo PIN — il PIN bar/admin resta l'unica vera porta
// d'ingresso. Questo serve solo a etichettare le azioni nel registro
// attività, così si sa chi ha fatto cosa.
export default function StaffGate({ role, onSelect }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const storageKey = STORAGE_PREFIX + role;

  useEffect(() => {
    const saved = typeof window !== "undefined" && window.sessionStorage.getItem(storageKey);
    if (saved) {
      onSelect(saved);
      return;
    }
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/staff");
    if (res.ok) {
      const { staff: list } = await res.json();
      setStaff((list || []).filter((s) => s.role === role || s.role === "entrambi"));
    }
    setLoading(false);
  }

  function pick(name) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, name);
    onSelect(name);
  }

  function skip() {
    pick("Staff"); // nessun nome specifico registrato, meglio di niente
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-stone-400 text-sm">Carico…</div>;

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-xs text-center">
        <div className="h-12 w-12 rounded-lg bg-stone-900 text-white grid place-items-center font-bold mx-auto mb-4">KO</div>
        <h1 className="text-lg font-bold mb-1">Chi sei?</h1>
        <p className="text-sm text-stone-500 mb-5">Serve solo per il registro attività — non è un altro PIN.</p>

        {staff.length > 0 && (
          <div className="space-y-2 mb-4">
            {staff.map((s) => (
              <button key={s.id} onClick={() => pick(s.name)} className="w-full text-sm font-semibold py-2.5 rounded-lg border border-stone-300 hover:bg-stone-50">
                {s.name}
              </button>
            ))}
          </div>
        )}

        {adding ? (
          <div className="flex gap-2 mb-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Il tuo nome"
              className="flex-1 text-sm border border-stone-300 rounded-lg px-3 py-2"
            />
            <button onClick={() => newName.trim() && pick(newName.trim())} className="text-sm font-semibold bg-stone-900 text-white px-3 rounded-lg">Ok</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs font-semibold text-stone-500 mb-3">
            + Il mio nome non c'è
          </button>
        )}

        <div>
          <button onClick={skip} className="text-xs text-stone-400">Salta per ora</button>
        </div>
      </div>
    </div>
  );
}

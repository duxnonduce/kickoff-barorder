"use client";

import { useEffect, useState } from "react";
import { Clock, Megaphone, Plus, Trash2 } from "lucide-react";

const DAY_LABELS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export default function HoursAndAnnouncements({ pin }) {
  const [hours, setHours] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [newTarget, setNewTarget] = useState("all");
  const [newFrom, setNewFrom] = useState("");
  const [newUntil, setNewUntil] = useState("");

  async function loadHours() {
    const res = await fetch("/api/opening-hours");
    const { hours } = await res.json();
    setHours((hours || []).sort((a, b) => a.day_of_week - b.day_of_week));
  }

  async function loadAnnouncements() {
    const res = await fetch("/api/announcements");
    const { announcements } = await res.json();
    setAnnouncements(announcements || []);
  }

  useEffect(() => { loadHours(); loadAnnouncements(); }, []);

  async function updateDay(day, patch) {
    setHours((prev) => prev.map((h) => (h.day_of_week === day.day_of_week ? { ...h, ...patch } : h)));
    await fetch("/api/opening-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        day_of_week: day.day_of_week,
        open_time: patch.open_time ?? day.open_time,
        close_time: patch.close_time ?? day.close_time,
        closed: patch.closed ?? day.closed,
      }),
    });
  }

  async function addAnnouncement() {
    if (!newMessage.trim()) return;
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        message: newMessage.trim(),
        target: newTarget,
        publish_from: newFrom ? new Date(newFrom).toISOString() : null,
        publish_until: newUntil ? new Date(newUntil).toISOString() : null,
      }),
    });
    setNewMessage("");
    setNewFrom("");
    setNewUntil("");
    loadAnnouncements();
  }

  async function toggleAnnouncement(a) {
    await fetch(`/api/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, active: !a.active }),
    });
    loadAnnouncements();
  }

  async function removeAnnouncement(a) {
    await fetch(`/api/announcements/${a.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    loadAnnouncements();
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
          <Clock className="h-3.5 w-3.5" /> Orari di apertura
        </div>
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
          {hours.map((h) => (
            <div key={h.day_of_week} className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm font-medium w-24 shrink-0">{DAY_LABELS[h.day_of_week]}</span>
              {h.closed ? (
                <span className="text-xs text-stone-400 flex-1">Chiuso</span>
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <input type="time" defaultValue={h.open_time?.slice(0, 5)} onBlur={(e) => updateDay(h, { open_time: e.target.value })} className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[88px]" />
                  <span className="text-stone-300 text-xs">–</span>
                  <input type="time" defaultValue={h.close_time?.slice(0, 5)} onBlur={(e) => updateDay(h, { close_time: e.target.value })} className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[88px]" />
                </div>
              )}
              <button
                onClick={() => updateDay(h, { closed: !h.closed })}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${h.closed ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}
              >
                {h.closed ? "Chiuso" : "Aperto"}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Gli ordini si chiudono automaticamente 15 minuti prima dell'orario di chiusura.
        </p>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
          <Megaphone className="h-3.5 w-3.5" /> Avvisi per i clienti
        </div>
        <div className="flex gap-2 mb-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Es. Oggi pizza margherita in offerta a 5€"
            className="flex-1 text-sm border border-stone-300 rounded-lg px-3 py-2"
          />
          <button onClick={addAnnouncement} className="flex items-center gap-1 text-sm font-semibold bg-stone-900 text-white px-3 py-2 rounded-lg shrink-0">
            <Plus className="h-3.5 w-3.5" /> Pubblica
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="text-xs border border-stone-300 rounded-md px-2 py-1.5">
            <option value="all">Tutte le zone</option>
            <option value="piscina">Solo piscina</option>
            <option value="campi">Solo campi</option>
            <option value="bar">Solo tavoli/bar</option>
          </select>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-stone-400">da</span>
            <input type="datetime-local" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="text-xs border border-stone-300 rounded-md px-1.5 py-1" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-stone-400">a</span>
            <input type="datetime-local" value={newUntil} onChange={(e) => setNewUntil(e.target.value)} className="text-xs border border-stone-300 rounded-md px-1.5 py-1" />
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
          {announcements.length === 0 && (
            <div className="text-sm text-stone-400 italic px-4 py-6 text-center">Nessun avviso pubblicato.</div>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${a.active ? "" : "text-stone-400 line-through"}`}>{a.message}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {a.target !== "all" && `${a.target === "piscina" ? "Piscina" : a.target === "campi" ? "Campi" : "Tavoli/Bar"}`}
                  {a.target !== "all" && (a.publish_from || a.publish_until) && " · "}
                  {a.publish_from && `dal ${new Date(a.publish_from).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                  {a.publish_from && a.publish_until && " "}
                  {a.publish_until && `al ${new Date(a.publish_until).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                </div>
              </div>
              <button onClick={() => toggleAnnouncement(a)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${a.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                {a.active ? "Attivo" : "Nascosto"}
              </button>
              <button onClick={() => removeAnnouncement(a)} className="text-stone-300 hover:text-rose-600 shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

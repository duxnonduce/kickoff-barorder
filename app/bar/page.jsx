"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PinGate from "@/components/PinGate";
import StaffGate from "@/components/StaffGate";
import HoursAndAnnouncements from "@/components/HoursAndAnnouncements";
import { Clock, UtensilsCrossed, Receipt, CheckCircle2, XCircle, Printer, CalendarClock, Waves, Sun, X } from "lucide-react";

const STATUS_LABEL = {
  in_attesa: "In attesa",
  accettato: "Accettato",
  pronto: "Pronto",
  rifiutato: "Rifiutato",
  completato: "Completato",
};

const SESSION_DATE_KEY = "kickoff_bar_session_date";

export default function BarPage() {
  const [pin, setPin] = useState(null);
  const [staffName, setStaffName] = useState(null);

  useEffect(() => {
    const today = new Date().toDateString();
    const savedDate = window.sessionStorage.getItem(SESSION_DATE_KEY);
    if (savedDate && savedDate !== today) {
      // è cambiato il giorno: si riparte da PIN e identità staff puliti
      window.sessionStorage.removeItem("kickoff_staff_bar");
      setPin(null);
      setStaffName(null);
    }
    window.sessionStorage.setItem(SESSION_DATE_KEY, today);
  }, []);

  if (!pin) return <PinGate label="Dashboard Bar" role="bar" onUnlock={setPin} />;
  if (!staffName) return <StaffGate role="bar" onSelect={setStaffName} />;
  return <BarDashboard pin={pin} staffName={staffName} />;
}

function BarDashboard({ pin, staffName }) {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("coda");
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [connected, setConnected] = useState(true);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [assistance, setAssistance] = useState([]);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);

  async function loadAll() {
    const [{ data: o }, { data: t }, { data: z }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("orders").select("*, order_items(*, order_item_options(*))").order("created_at", { ascending: false }).limit(60),
      supabase.from("tables").select("*"),
      supabase.from("zones").select("*"),
      supabase.from("products").select("*").order("name"),
      supabase.from("assistance_requests").select("*").eq("status", "pending").order("created_at"),
    ]);
    setOrders(o || []);
    setTables(t || []);
    setZones(z || []);
    setProducts(p || []);
    setAssistance(a || []);
  }

  async function loadServiceStatus() {
    const res = await fetch("/api/service-status");
    if (res.ok) { const { status } = await res.json(); setServiceStatus(status); }
  }

  useEffect(() => {
    loadAll();
    loadServiceStatus();
    const channel = supabase
      .channel("bar-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "assistance_requests" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_status" }, (payload) => setServiceStatus(payload.new))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          loadAll(); // riallineo nel caso mi sia perso eventi durante una disconnessione
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    return () => supabase.removeChannel(channel);
  }, []);

  async function updateServiceStatus(patch) {
    const res = await fetch("/api/service-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, ...patch }),
    });
    if (res.ok) { const { status } = await res.json(); setServiceStatus(status); }
  }

  async function togglePriority(order) {
    const next = order.priority === "urgent" ? "normal" : "urgent";
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, priority: next }),
    });
    logActivity(next === "urgent" ? "Ordine segnato urgente" : "Ordine rimesso normale", order.code);
    loadAll();
  }

  async function resolveAssistance(id) {
    await fetch(`/api/assistance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    loadAll();
  }

  const tableOf = (id) => tables.find((t) => t.id === id);
  const zoneOf = (id) => zones.find((z) => z.id === id);

  async function handleReprint(order) {
    const res = await fetch(`/api/orders/${order.id}/reprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) setReceiptOrder(order);
    loadAll();
  }

  async function handleModifyOrder(order, removeItemIds) {
    const res = await fetch(`/api/orders/${order.id}/modify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, removeItemIds }),
    });
    if (res.ok) {
      logActivity("Ordine modificato e accettato", `${order.code} — rimossi ${removeItemIds.length} prodott${removeItemIds.length === 1 ? "o" : "i"}`);
      setReceiptOrder(order);
    }
    setModifyingOrder(null);
    loadAll();
  }

  function logActivity(action, details) {
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, staff_name: staffName, action, details }),
    }).catch(() => {});
  }

  async function setStatus(order, status, reject_reason) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, pin, reject_reason }),
    });
    if (res.ok && status === "accettato") setReceiptOrder(order);
    if (res.ok) {
      const labels = { accettato: "Ordine accettato", rifiutato: "Ordine rifiutato", pronto: "Ordine segnato pronto", completato: "Ordine completato" };
      logActivity(labels[status] || `Ordine → ${status}`, `${order.code}${reject_reason ? ` — ${reject_reason}` : ""}`);
    }
    loadAll();
  }

  async function toggleProduct(p) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !p.available, pin }),
    });
    logActivity(!p.available ? "Prodotto riattivato" : "Prodotto disattivato", p.name);
    loadAll();
  }

  const now = Date.now();
  const SOON_THRESHOLD_MS = 30 * 60000; // entro 30 minuti -> nella coda live
  const allPending = orders.filter((o) => o.status === "in_attesa");
  const upcoming = allPending
    .filter((o) => o.requested_time && new Date(o.requested_time).getTime() - now > SOON_THRESHOLD_MS)
    .sort((a, b) => new Date(a.requested_time) - new Date(b.requested_time));
  const pending = allPending.filter((o) => !upcoming.includes(o));
  const active = orders.filter((o) => o.status === "accettato" || o.status === "pronto");
  const done = orders.filter((o) => o.status === "completato" || o.status === "rifiutato").slice(0, 15);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="KickOff" className="h-9 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">Coda ordini</h1>
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ${connected ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-600" : "bg-rose-600 animate-pulse"}`} />
            {connected ? "Sistema online" : "Connessione persa"}
          </span>
          {staffName && staffName !== "Staff" && (
            <span className="text-xs text-stone-400">Ciao, {staffName}</span>
          )}
        </div>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg text-sm">
          {["coda", "mappa", "prodotti", "orari"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md font-medium capitalize ${tab === t ? "bg-white shadow-sm" : "text-stone-500"}`}>{t === "orari" ? "Orari & Avvisi" : t}</button>
          ))}
        </div>
      </div>

      {tab === "coda" && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {serviceStatus?.paused ? (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
              <span className="font-semibold text-rose-800">⏸ Ordini sospesi</span>
              {serviceStatus.pause_reason && <span className="text-rose-600 text-xs">— {serviceStatus.pause_reason}</span>}
              <button onClick={() => updateServiceStatus({ paused: false, pause_reason: null, paused_until: null })} className="text-xs font-semibold text-rose-700 underline ml-2">
                Riprendi ordini
              </button>
            </div>
          ) : (
            <button onClick={() => setPauseModalOpen(true)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-stone-300 text-stone-600">
              ⏸ Sospendi ordini
            </button>
          )}

          <button
            onClick={() => updateServiceStatus({ delivery_disabled: !serviceStatus?.delivery_disabled })}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border ${serviceStatus?.delivery_disabled ? "bg-amber-50 border-amber-300 text-amber-800" : "border-stone-300 text-stone-600"}`}
          >
            {serviceStatus?.delivery_disabled ? "🚴 Consegne disattivate — riattiva" : "🚴 Disattiva consegne"}
          </button>
        </div>
      )}

      {tab === "coda" && assistance.length > 0 && (
        <div className="mb-5 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">🔔 Richieste in sospeso ({assistance.length})</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {assistance.map((a) => {
              const table = tableOf(a.table_id);
              return (
                <div key={a.id} className="bg-white border border-rose-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <div className="font-bold">{table?.label || "—"}</div>
                    <div className="text-stone-500">{a.type === "staff" ? "Chiama staff" : "Richiede il conto"}</div>
                  </div>
                  <button onClick={() => resolveAssistance(a.id)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-stone-900 text-white shrink-0">Risolto</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "coda" && upcoming.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
            <CalendarClock className="h-3.5 w-3.5" /> Prossimi ordini ({upcoming.length})
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {upcoming.map((o) => {
              const table = tableOf(o.table_id);
              return (
                <div key={o.id} className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold">{o.code} · {table?.label}</div>
                    <div className="text-xs text-amber-700 font-medium">
                      {new Date(o.requested_time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <button onClick={() => setStatus(o, "accettato")} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-stone-900 text-white shrink-0">Accetta ora</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "coda" && (
        <div className="grid md:grid-cols-3 gap-5">
          <Column title="Nuovi · da accettare" icon={Clock} orders={pending} tableOf={tableOf} zoneOf={zoneOf} onTogglePriority={togglePriority}
            actions={(o) => (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <button onClick={() => setRejectingOrder(o)} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-md border border-rose-300 text-rose-700"><XCircle className="h-3.5 w-3.5" /> Rifiuta</button>
                  <button onClick={() => setStatus(o, "accettato")} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-md bg-stone-900 text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Accetta</button>
                </div>
                {(o.order_items || []).length > 1 && (
                  <button onClick={() => setModifyingOrder(o)} className="w-full text-[11px] font-semibold text-stone-500 hover:text-stone-800">
                    Manca un prodotto? Modifica ed accetta
                  </button>
                )}
              </div>
            )}
          />
          <Column title="In preparazione" icon={UtensilsCrossed} orders={active} tableOf={tableOf} zoneOf={zoneOf} onReprint={handleReprint} onTogglePriority={togglePriority}
            actions={(o) => o.status === "accettato" ? (
              <button onClick={() => setStatus(o, "pronto")} className="w-full text-xs font-semibold py-1.5 rounded-md bg-emerald-700 text-white">Segna come pronto</button>
            ) : (
              <button onClick={() => setStatus(o, "completato")} className="w-full text-xs font-semibold py-1.5 rounded-md bg-stone-700 text-white">{o.type === "ritiro" ? "Ritirato" : "Consegnato"}</button>
            )}
          />
          <Column title="Storico" icon={Receipt} orders={done} tableOf={tableOf} zoneOf={zoneOf} muted onReprint={handleReprint} />
        </div>
      )}

      {tab === "prodotti" && (
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-stone-400">€{Number(p.price).toFixed(2)}</div>
              </div>
              <button onClick={() => toggleProduct(p)} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${p.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                {p.available ? "Disponibile" : "Esaurito"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "mappa" && (
        <MapPanel zones={zones} tables={tables} orders={orders} setStatus={setStatus} setRejectingOrder={setRejectingOrder} />
      )}
      {tab === "orari" && <HoursAndAnnouncements pin={pin} />}

      {receiptOrder && <ReceiptModal order={receiptOrder} table={tableOf(receiptOrder.table_id)} onClose={() => setReceiptOrder(null)} />}
      {rejectingOrder && (
        <RejectModal
          order={rejectingOrder}
          onClose={() => setRejectingOrder(null)}
          onConfirm={(reason) => { setStatus(rejectingOrder, "rifiutato", reason); setRejectingOrder(null); }}
        />
      )}
      {modifyingOrder && (
        <ModifyOrderModal
          order={modifyingOrder}
          onClose={() => setModifyingOrder(null)}
          onConfirm={(removeItemIds) => handleModifyOrder(modifyingOrder, removeItemIds)}
        />
      )}
      {pauseModalOpen && (
        <PauseServiceModal
          onClose={() => setPauseModalOpen(false)}
          onConfirm={(reason, minutes) => {
            const paused_until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
            updateServiceStatus({ paused: true, pause_reason: reason, paused_until });
            logActivity("Ordini sospesi", `${reason}${minutes ? ` (${minutes} min)` : ""}`);
            setPauseModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

const PAUSE_REASONS = ["Cucina congestionata", "Problemi tecnici", "Cambio turno", "Chiusura anticipata", "Evento in corso", "Altro"];

function PauseServiceModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState(PAUSE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [minutes, setMinutes] = useState(null); // null = manuale

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold mb-1">Sospendi ordini</div>
        <p className="text-xs text-stone-500 mb-3">Il cliente vedrà questo messaggio al posto del menu.</p>
        <div className="space-y-1.5 mb-3">
          {PAUSE_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="pause_reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        {reason === "Altro" && (
          <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Scrivi il motivo" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 mb-3" />
        )}
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Per quanto tempo</div>
        <div className="flex gap-1.5 mb-4">
          {[{ label: "15 min", v: 15 }, { label: "30 min", v: 30 }, { label: "1 ora", v: 60 }, { label: "Manuale", v: null }].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setMinutes(opt.v)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md border ${minutes === opt.v ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm font-semibold py-2 rounded-lg border border-stone-300">Annulla</button>
          <button
            onClick={() => onConfirm(reason === "Altro" ? (customReason.trim() || "Altro") : reason, minutes)}
            className="flex-1 text-sm font-semibold py-2 rounded-lg bg-rose-700 text-white"
          >
            Sospendi
          </button>
        </div>
      </div>
    </div>
  );
}

const REJECT_REASONS = [
  "Prodotto terminato",
  "Cucina chiusa",
  "Impossibile rispettare l'orario richiesto",
  "Errore nell'ordine",
  "Altro",
];

function RejectModal({ order, onClose, onConfirm }) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold mb-1">Rifiuta ordine {order.code}</div>
        <p className="text-xs text-stone-500 mb-3">Il cliente vedrà questo motivo, aiuta a evitare confusione.</p>
        <div className="space-y-1.5 mb-3">
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="reject_reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        {reason === "Altro" && (
          <input
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Scrivi il motivo"
            className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 mb-3"
          />
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm font-semibold py-2 rounded-lg border border-stone-300">Annulla</button>
          <button
            onClick={() => onConfirm(reason === "Altro" ? (customReason.trim() || "Altro") : reason)}
            className="flex-1 text-sm font-semibold py-2 rounded-lg bg-rose-700 text-white"
          >
            Conferma rifiuto
          </button>
        </div>
      </div>
    </div>
  );
}

function ModifyOrderModal({ order, onClose, onConfirm }) {
  const [removed, setRemoved] = useState([]); // id delle righe da togliere
  const items = order.order_items || [];

  function toggle(itemId) {
    setRemoved((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }

  const remainingTotal = items
    .filter((it) => !removed.includes(it.id))
    .reduce((s, it) => s + Number(it.price) * it.qty, 0);

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold mb-1">Modifica ordine {order.code}</div>
        <p className="text-xs text-stone-500 mb-3">Deseleziona i prodotti esauriti o non disponibili: il resto verrà accettato subito.</p>
        <div className="space-y-1.5 mb-3">
          {items.map((it) => (
            <label key={it.id} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-sm ${removed.includes(it.id) ? "border-stone-200 bg-stone-50 opacity-50" : "border-stone-200"}`}>
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={!removed.includes(it.id)} onChange={() => toggle(it.id)} />
                {it.qty}× {it.name}
              </span>
              <span className="text-xs text-stone-500 tabular-nums">€{(Number(it.price) * it.qty).toFixed(2)}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm font-bold mb-3 border-t border-stone-100 pt-2">
          <span>Nuovo totale</span>
          <span className="tabular-nums">€{remainingTotal.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm font-semibold py-2 rounded-lg border border-stone-300">Annulla</button>
          <button
            onClick={() => onConfirm(removed)}
            disabled={removed.length === 0}
            className="flex-1 text-sm font-semibold py-2 rounded-lg bg-stone-900 text-white disabled:opacity-40"
          >
            Accetta modificato
          </button>
        </div>
      </div>
    </div>
  );
}

function Column({ title, icon: Icon, orders, tableOf, zoneOf, actions, muted, onReprint, onTogglePriority }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="h-4 w-4 text-stone-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">{title}</h2>
        <span className="text-xs text-stone-300 tabular-nums">({orders.length})</span>
      </div>
      <div className="space-y-3">
        {orders.length === 0 && <div className="text-xs text-stone-300 italic py-4 text-center border border-dashed border-stone-200 rounded-lg">Nessun ordine</div>}
        {[...orders].sort((a, b) => (b.priority === "urgent" ? 1 : 0) - (a.priority === "urgent" ? 1 : 0)).map((o) => {
          const table = tableOf(o.table_id);
          return (
            <div key={o.id} className={`rounded-xl border p-3 ${o.priority === "urgent" ? "border-rose-300 bg-rose-50" : muted ? "border-stone-100 bg-stone-50 opacity-70" : "border-stone-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-black tabular-nums text-lg tracking-tight">{o.code}</span>
                  {o.priority === "urgent" && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-rose-600 text-white">🔴 Urgente</span>}
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200">{STATUS_LABEL[o.status]}</span>
              </div>
              <div className="text-xs font-semibold text-stone-600 mb-1">{table?.label} · {o.type === "ritiro" ? "Ritiro" : "Consegna"}</div>
              {o.customer_name && (
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-stone-500">{o.customer_name} · {o.customer_phone}</div>
                  {o.customer_phone && (
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={`tel:${o.customer_phone}`} className="text-[11px] font-semibold text-stone-500 hover:text-stone-800">📞</a>
                      <a href={`https://wa.me/${o.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-stone-500 hover:text-stone-800">💬</a>
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs font-medium text-stone-500 mb-2">
                {o.requested_time
                  ? `Richiesto per le ${new Date(o.requested_time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
                  : "Il prima possibile"}
              </div>
              <div className="mb-2 space-y-1.5">
                {["bar", "cucina"].map((station) => {
                  const stationItems = (o.order_items || []).filter((it) => (it.station || "bar") === station);
                  if (stationItems.length === 0) return null;
                  return (
                    <div key={station}>
                      <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${station === "bar" ? "text-teal-700" : "text-orange-700"}`}>
                        {station === "bar" ? "🍹 Bar" : "🍳 Cucina"}
                      </div>
                      <div className="text-xs text-stone-600 space-y-0.5">
                        {stationItems.map((it) => (
                          <div key={it.id}>
                            <div>{it.qty}× {it.name}</div>
                            {it.order_item_options?.length > 0 && (
                              <div className="text-stone-400 pl-2.5">{it.order_item_options.map((o) => o.option_name).join(", ")}</div>
                            )}
                            {it.note && <div className="text-stone-400 italic pl-2.5">— {it.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {o.order_items?.length > 0 && (
                <div className="text-[11px] text-stone-400 mb-2">
                  Tempo stimato: ~{Math.max(...o.order_items.map((it) => it.prep_min || 5))} min
                </div>
              )}
              {o.note && <div className="text-xs italic text-stone-400 mb-2">"{o.note}"</div>}
              {o.status === "rifiutato" && o.reject_reason && (
                <div className="text-xs text-rose-600 mb-2">Motivo: {o.reject_reason}</div>
              )}
              <div className="flex justify-between text-xs font-bold mb-2"><span>Totale</span><span className="tabular-nums">€{Number(o.total).toFixed(2)}</span></div>
              {o.printed_at && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-stone-400">
                    {o.reprint_count > 0 ? `Ristampato ${o.reprint_count} volt${o.reprint_count === 1 ? "a" : "e"}` : "Stampato"}
                  </span>
                  {onReprint && (
                    <button onClick={() => onReprint(o)} className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-800">
                      <Printer className="h-3 w-3" /> Ristampa
                    </button>
                  )}
                </div>
              )}
              {onTogglePriority && o.status !== "completato" && o.status !== "rifiutato" && (
                <button onClick={() => onTogglePriority(o)} className={`w-full text-[11px] font-semibold py-1 rounded-md mb-2 ${o.priority === "urgent" ? "bg-rose-100 text-rose-700" : "border border-stone-200 text-stone-500"}`}>
                  {o.priority === "urgent" ? "Rimuovi urgenza" : "🔴 Segna come urgente"}
                </button>
              )}
              {actions && actions(o)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptModal({ order, table, onClose }) {
  const items = order.order_items || [];
  const barItems = items.filter((it) => (it.station || "bar") === "bar");
  const kitchenItems = items.filter((it) => it.station === "cucina");
  const hasBoth = barItems.length > 0 && kitchenItems.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 text-emerald-700 mb-3">
          <Printer className="h-4 w-4" />
          <span className="text-sm font-semibold">
            {hasBoth ? "2 comande inviate alla stampante di rete" : "Scontrino inviato alla stampante di rete"}
          </span>
        </div>

        {barItems.length > 0 && (
          <Ticket
            title="KICKOFF · BAR"
            order={order} table={table} items={barItems}
            showTotal
          />
        )}

        {kitchenItems.length > 0 && (
          <Ticket
            title="COMANDA CUCINA"
            order={order} table={table} items={kitchenItems}
            className={barItems.length > 0 ? "mt-3" : ""}
          />
        )}

        <button onClick={onClose} className="w-full mt-4 bg-stone-900 text-white text-sm font-semibold rounded-lg py-2">Ok, chiudi</button>
      </div>
    </div>
  );
}

function Ticket({ title, order, table, items, showTotal, className = "" }) {
  const subtotal = items.reduce((s, it) => s + Number(it.price) * it.qty, 0);
  return (
    <div className={`border border-dashed border-stone-300 rounded-lg p-4 font-mono text-xs bg-stone-50 ${className}`}>
      <div className="flex justify-center mb-2">
        <img src="/logo-icon.png" alt="KickOff" className="h-8 w-auto" />
      </div>
      <div className="text-center font-bold mb-1">{title}</div>
      <div className="text-center text-stone-500 mb-2">Ordine {order.code}</div>
      <div className="border-t border-stone-300 my-2" />
      <div>{table?.label}</div>
      <div>{order.type === "ritiro" ? "RITIRO AL BANCO" : "CONSEGNA IN ZONA"}</div>
      {showTotal && order.customer_name && <div>{order.customer_name} · {order.customer_phone}</div>}
      <div>{order.requested_time ? `Ore ${new Date(order.requested_time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : "Il prima possibile"}</div>
      <div className="border-t border-stone-300 my-2" />
      {items.map((it) => (
        <div key={it.id}>
          <div className="flex justify-between">
            <span>{it.qty}× {it.name}</span>
            {showTotal && <span>€{(Number(it.price) * it.qty).toFixed(2)}</span>}
          </div>
          {it.order_item_options?.length > 0 && (
            <div className="text-stone-500 pl-2">{it.order_item_options.map((o) => o.option_name).join(", ")}</div>
          )}
          {it.note && <div className="text-stone-500 pl-2">↳ {it.note}</div>}
        </div>
      ))}
      {showTotal && (
        <>
          <div className="border-t border-stone-300 my-2" />
          <div className="flex justify-between font-bold"><span>{items.length === (order.order_items || []).length ? "TOTALE" : "SUBTOTALE BAR"}</span><span>€{subtotal.toFixed(2)}</span></div>
          {items.length !== (order.order_items || []).length && (
            <div className="flex justify-between font-bold pt-1"><span>TOTALE ORDINE</span><span>€{Number(order.total).toFixed(2)}</span></div>
          )}
        </>
      )}
      {order.note && <div className="mt-2 text-stone-500">Nota generale: {order.note}</div>}
    </div>
  );
}

const ZONE_MAP_STYLE = {
  piscina: { icon: Waves, bg: "bg-teal-700", soft: "bg-teal-50", border: "border-teal-200", text: "text-teal-800" },
  campi: { icon: Sun, bg: "bg-orange-700", soft: "bg-orange-50", border: "border-orange-200", text: "text-orange-800" },
  bar: { icon: UtensilsCrossed, bg: "bg-stone-700", soft: "bg-stone-50", border: "border-stone-200", text: "text-stone-800" },
};

function tableDotStatus(table, orders) {
  const active = orders.filter((o) => o.table_id === table.id && ["in_attesa", "accettato", "pronto"].includes(o.status));
  if (active.some((o) => o.status === "pronto")) return { color: "bg-sky-500", label: "Pronto da consegnare", order: active.find((o) => o.status === "pronto") };
  if (active.some((o) => o.status === "accettato")) return { color: "bg-amber-500", label: "In preparazione", order: active.find((o) => o.status === "accettato") };
  if (active.some((o) => o.status === "in_attesa")) return { color: "bg-rose-500", label: "Nuovo ordine, da accettare", order: active.find((o) => o.status === "in_attesa") };
  return { color: "bg-emerald-400", label: "Nessun ordine attivo", order: null };
}

function MapPanel({ zones, tables, orders, setStatus, setRejectingOrder }) {
  const [selected, setSelected] = useState(null); // ordine selezionato per il popover

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 text-xs text-stone-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Libero</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Da accettare</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> In preparazione</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Pronto</span>
      </div>

      <div className="space-y-6">
        {zones.map((z) => {
          const zTables = tables.filter((t) => t.zone_id === z.id && !t.archived_at);
          if (zTables.length === 0) return null;
          const style = ZONE_MAP_STYLE[z.type] || ZONE_MAP_STYLE.bar;
          const ZIcon = style.icon;
          return (
            <div key={z.id}>
              <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2 ${style.text}`}>
                <ZIcon className="h-3.5 w-3.5" /> {z.name}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                {zTables.map((t) => {
                  const status = tableDotStatus(t, orders);
                  return (
                    <button
                      key={t.id}
                      onClick={() => status.order && setSelected(status.order)}
                      className={`relative border rounded-xl p-3 text-left ${style.soft} ${style.border} ${status.order ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
                    >
                      <span className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full ${status.color}`} />
                      <div className="text-xs font-semibold truncate pr-3">{t.label}</div>
                      {status.order && <div className="text-[10px] text-stone-500 mt-0.5">{status.order.code}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-black text-lg tracking-tight">{selected.code}</span>
              <button onClick={() => setSelected(null)}><X className="h-4 w-4 text-stone-400" /></button>
            </div>
            <div className="text-xs text-stone-500 mb-2">{STATUS_LABEL[selected.status]}</div>
            <div className="text-xs text-stone-600 space-y-0.5 mb-3">
              {(selected.order_items || []).map((it) => (
                <div key={it.id}>
                  {it.qty}× {it.name}
                  {it.order_item_options?.length > 0 && <span className="text-stone-400"> ({it.order_item_options.map((o) => o.option_name).join(", ")})</span>}
                </div>
              ))}
            </div>
            {selected.status === "in_attesa" && (
              <div className="flex gap-2">
                <button onClick={() => { setRejectingOrder(selected); setSelected(null); }} className="flex-1 text-xs font-semibold py-1.5 rounded-md border border-rose-300 text-rose-700">Rifiuta</button>
                <button onClick={() => { setStatus(selected, "accettato"); setSelected(null); }} className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-stone-900 text-white">Accetta</button>
              </div>
            )}
            {selected.status === "accettato" && (
              <button onClick={() => { setStatus(selected, "pronto"); setSelected(null); }} className="w-full text-xs font-semibold py-1.5 rounded-md bg-emerald-700 text-white">Segna come pronto</button>
            )}
            {selected.status === "pronto" && (
              <button onClick={() => { setStatus(selected, "completato"); setSelected(null); }} className="w-full text-xs font-semibold py-1.5 rounded-md bg-stone-700 text-white">
                {selected.type === "ritiro" ? "Ritirato" : "Consegnato"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

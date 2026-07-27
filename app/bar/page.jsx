"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PinGate from "@/components/PinGate";
import { Clock, UtensilsCrossed, Receipt, CheckCircle2, XCircle, Printer } from "lucide-react";

const STATUS_LABEL = {
  in_attesa: "In attesa",
  accettato: "Accettato",
  pronto: "Pronto",
  rifiutato: "Rifiutato",
  completato: "Completato",
};

export default function BarPage() {
  const [pin, setPin] = useState(null);

  if (!pin) return <PinGate label="Dashboard Bar" role="bar" onUnlock={setPin} />;
  return <BarDashboard pin={pin} />;
}

function BarDashboard({ pin }) {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("coda");
  const [receiptOrder, setReceiptOrder] = useState(null);

  async function loadAll() {
    const [{ data: o }, { data: t }, { data: z }, { data: p }] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(60),
      supabase.from("tables").select("*"),
      supabase.from("zones").select("*"),
      supabase.from("products").select("*").order("name"),
    ]);
    setOrders(o || []);
    setTables(t || []);
    setZones(z || []);
    setProducts(p || []);
  }

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("bar-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const tableOf = (id) => tables.find((t) => t.id === id);
  const zoneOf = (id) => zones.find((z) => z.id === id);

  async function setStatus(order, status) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, pin }),
    });
    if (res.ok && status === "accettato") setReceiptOrder(order);
    loadAll();
  }

  async function toggleProduct(p) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !p.available, pin }),
    });
    loadAll();
  }

  const pending = orders.filter((o) => o.status === "in_attesa");
  const active = orders.filter((o) => o.status === "accettato" || o.status === "pronto");
  const done = orders.filter((o) => o.status === "completato" || o.status === "rifiutato").slice(0, 15);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Coda ordini</h1>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg text-sm">
          {["coda", "prodotti"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md font-medium capitalize ${tab === t ? "bg-white shadow-sm" : "text-stone-500"}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "coda" && (
        <div className="grid md:grid-cols-3 gap-5">
          <Column title="Nuovi · da accettare" icon={Clock} orders={pending} tableOf={tableOf} zoneOf={zoneOf}
            actions={(o) => (
              <div className="flex gap-2">
                <button onClick={() => setStatus(o, "rifiutato")} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-md border border-rose-300 text-rose-700"><XCircle className="h-3.5 w-3.5" /> Rifiuta</button>
                <button onClick={() => setStatus(o, "accettato")} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-md bg-stone-900 text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Accetta</button>
              </div>
            )}
          />
          <Column title="In preparazione" icon={UtensilsCrossed} orders={active} tableOf={tableOf} zoneOf={zoneOf}
            actions={(o) => o.status === "accettato" ? (
              <button onClick={() => setStatus(o, "pronto")} className="w-full text-xs font-semibold py-1.5 rounded-md bg-emerald-700 text-white">Segna come pronto</button>
            ) : (
              <button onClick={() => setStatus(o, "completato")} className="w-full text-xs font-semibold py-1.5 rounded-md bg-stone-700 text-white">{o.type === "ritiro" ? "Ritirato" : "Consegnato"}</button>
            )}
          />
          <Column title="Storico" icon={Receipt} orders={done} tableOf={tableOf} zoneOf={zoneOf} muted />
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

      {receiptOrder && <ReceiptModal order={receiptOrder} table={tableOf(receiptOrder.table_id)} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}

function Column({ title, icon: Icon, orders, tableOf, zoneOf, actions, muted }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="h-4 w-4 text-stone-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">{title}</h2>
        <span className="text-xs text-stone-300 tabular-nums">({orders.length})</span>
      </div>
      <div className="space-y-3">
        {orders.length === 0 && <div className="text-xs text-stone-300 italic py-4 text-center border border-dashed border-stone-200 rounded-lg">Nessun ordine</div>}
        {orders.map((o) => {
          const table = tableOf(o.table_id);
          return (
            <div key={o.id} className={`rounded-xl border p-3 ${muted ? "border-stone-100 bg-stone-50 opacity-70" : "border-stone-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black tabular-nums text-lg tracking-tight">{o.code}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200">{STATUS_LABEL[o.status]}</span>
              </div>
              <div className="text-xs font-semibold text-stone-600 mb-2">{table?.label} · {o.type === "ritiro" ? "Ritiro" : "Consegna"}</div>
              <div className="text-xs text-stone-600 space-y-0.5 mb-2">
                {o.order_items?.map((it) => <div key={it.id}>{it.qty}× {it.name}</div>)}
              </div>
              {o.note && <div className="text-xs italic text-stone-400 mb-2">"{o.note}"</div>}
              <div className="flex justify-between text-xs font-bold mb-2"><span>Totale</span><span className="tabular-nums">€{Number(o.total).toFixed(2)}</span></div>
              {actions && actions(o)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptModal({ order, table, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-5">
        <div className="flex items-center gap-2 text-emerald-700 mb-3">
          <Printer className="h-4 w-4" />
          <span className="text-sm font-semibold">Scontrino inviato alla stampante di rete</span>
        </div>
        <div className="border border-dashed border-stone-300 rounded-lg p-4 font-mono text-xs bg-stone-50">
          <div className="text-center font-bold mb-1">KICKOFF · BAR</div>
          <div className="text-center text-stone-500 mb-2">Ordine {order.code}</div>
          <div className="border-t border-stone-300 my-2" />
          <div>{table?.label}</div>
          <div>{order.type === "ritiro" ? "RITIRO AL BANCO" : "CONSEGNA IN ZONA"}</div>
          <div className="border-t border-stone-300 my-2" />
          {order.order_items?.map((it) => (
            <div key={it.id} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>€{(Number(it.price) * it.qty).toFixed(2)}</span></div>
          ))}
          <div className="border-t border-stone-300 my-2" />
          <div className="flex justify-between font-bold"><span>TOTALE</span><span>€{Number(order.total).toFixed(2)}</span></div>
        </div>
        <button onClick={onClose} className="w-full mt-4 bg-stone-900 text-white text-sm font-semibold rounded-lg py-2">Ok, chiudi</button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Minus, ShoppingBag, Bike, Ban, ArrowLeft, CheckCircle2, Clock, Megaphone } from "lucide-react";

const ZONE_STYLE = {
  piscina: { text: "text-teal-800", soft: "bg-teal-50", border: "border-teal-200" },
  campi: { text: "text-orange-800", soft: "bg-orange-50", border: "border-orange-200" },
  bar: { text: "text-stone-800", soft: "bg-stone-100", border: "border-stone-300" },
};

const CUSTOMER_STORAGE_KEY = "kickoff_customer";

function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  let next = new Date(now.getTime() + 20 * 60000); // parti da +20 min
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
  const closing = new Date(now);
  closing.setHours(23, 0, 0, 0);
  while (next <= closing && slots.length < 20) {
    slots.push(new Date(next));
    next = new Date(next.getTime() + 15 * 60000);
  }
  return slots;
}

export default function OrderPage() {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [zone, setZone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState("ritiro");
  const [note, setNote] = useState("");
  const [requestedTime, setRequestedTime] = useState("asap");
  const [loading, setLoading] = useState(true);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [customer, setCustomer] = useState(null); // { name, email, phone }
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [todayHours, setTodayHours] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  const timeSlots = useMemo(() => generateTimeSlots(), []);

  useEffect(() => {
    async function loadSettings() {
      const [hoursRes, annRes] = await Promise.all([
        fetch("/api/opening-hours"),
        fetch("/api/announcements"),
      ]);
      const { hours } = await hoursRes.json();
      const { announcements: ann } = await annRes.json();
      const today = new Date().getDay();
      setTodayHours((hours || []).find((h) => h.day_of_week === today) || null);
      setAnnouncements((ann || []).filter((a) => a.active));
    }
    loadSettings();
  }, []);

  const orderingStatus = useMemo(() => {
    if (!todayHours) return { open: true }; // finché non carica, non blocco l'utente
    if (todayHours.closed) return { open: false, reason: "closed_today" };
    const now = new Date();
    const [oh, om] = todayHours.open_time.slice(0, 5).split(":").map(Number);
    const [ch, cm] = todayHours.close_time.slice(0, 5).split(":").map(Number);
    const openAt = new Date(now); openAt.setHours(oh, om, 0, 0);
    const closeAt = new Date(now); closeAt.setHours(ch, cm, 0, 0);
    const cutoffAt = new Date(closeAt.getTime() - 15 * 60000);
    if (now < openAt) return { open: false, reason: "not_yet_open", openAt };
    if (now >= cutoffAt) return { open: false, reason: "past_cutoff", closeAt };
    return { open: true, cutoffAt };
  }, [todayHours]);

  const fmtTime = (d) => d?.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    const saved = typeof window !== "undefined" && window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (saved) {
      try { setCustomer(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from("tables").select("*").eq("id", tableId).single();
      if (!t) { setLoading(false); return; }
      setTable(t);
      const { data: z } = await supabase.from("zones").select("*").eq("id", t.zone_id).single();
      setZone(z);
      const { data: cats } = await supabase.from("categories").select("*").order("sort_order");
      setCategories(cats || []);
      const { data: prods } = await supabase.from("products").select("*").order("name");
      setProducts(prods || []);
      setLoading(false);
    }
    load();
  }, [tableId]);

  useEffect(() => {
    const channel = supabase
      .channel("products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
        setProducts((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (!placedOrder) return;
    const channel = supabase
      .channel(`order-${placedOrder.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${placedOrder.id}` }, (payload) => {
        setPlacedOrder((prev) => ({ ...prev, ...payload.new }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [placedOrder?.id]);

  const cartItems = useMemo(
    () => Object.entries(cart).filter(([, q]) => q > 0).map(([pid, q]) => ({ product: products.find((p) => p.id === pid), qty: q })),
    [cart, products]
  );
  const subtotal = cartItems.reduce((s, i) => s + Number(i.product.price) * i.qty, 0);
  const surcharge = mode === "consegna" ? Number(zone?.surcharge || 0) : 0;
  const total = subtotal + surcharge;

  function addQty(pid, delta) {
    setCart((prev) => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) + delta) }));
  }

  function saveCustomer(info) {
    setCustomer(info);
    if (typeof window !== "undefined") {
      if (info) window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
      else window.localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    }
  }

  async function handleSubmit() {
    if (cartItems.length === 0 || !customer) return;
    if (todayHours) {
      const now = new Date();
      const [ch, cm] = todayHours.close_time.slice(0, 5).split(":").map(Number);
      const closeAt = new Date(now); closeAt.setHours(ch, cm, 0, 0);
      const cutoffAt = new Date(closeAt.getTime() - 15 * 60000);
      if (todayHours.closed || now >= cutoffAt) {
        setError("Gli ordini sono appena stati chiusi per oggi. Riprova domani.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      const custData = await custRes.json();
      if (!custRes.ok) throw new Error(custData.error || "Errore registrazione");

      const requestedIso = requestedTime === "asap" ? null : requestedTime;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          table_id: table.id,
          zone_id: zone.id,
          type: mode,
          total,
          note: note || null,
          customer_id: custData.customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email || null,
          requested_time: requestedIso,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const items = cartItems.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        name: i.product.name,
        price: i.product.price,
        qty: i.qty,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      setPlacedOrder({ ...order, items });
      setCart({});
      setNote("");
      setCheckoutOpen(false);
    } catch (e) {
      setError("Non sono riuscito a inviare l'ordine. Riprova.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-stone-400 text-sm">Carico il menu…</div>;
  if (!table) return <div className="min-h-screen grid place-items-center text-stone-400 text-sm px-6 text-center">Postazione non trovata. Controlla il QR code.</div>;

  if (placedOrder) {
    return <OrderTrackView order={placedOrder} table={table} zone={zone} onBack={() => setPlacedOrder(null)} />;
  }

  const zs = ZONE_STYLE[zone?.type] || ZONE_STYLE.bar;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-40">
      <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border ${zs.soft} ${zs.border}`}>
        <span className={`text-sm font-semibold ${zs.text}`}>{table.label}</span>
        <span className="text-xs text-stone-500">· {zone?.name}</span>
      </div>

      {orderingStatus.open && orderingStatus.cutoffAt && (
        <div className="mb-4 text-xs text-stone-500 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Puoi ordinare fino alle {fmtTime(orderingStatus.cutoffAt)}
        </div>
      )}

      {announcements.map((a) => (
        <div key={a.id} className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 text-sm">
          <Megaphone className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{a.message}</span>
        </div>
      ))}

      {!orderingStatus.open && (
        <div className="mb-6 bg-stone-100 border border-stone-200 rounded-xl p-4 text-sm text-stone-600">
          {orderingStatus.reason === "closed_today" && "Il bar è chiuso oggi. Non è possibile inviare ordini."}
          {orderingStatus.reason === "not_yet_open" && `Il bar apre alle ${fmtTime(orderingStatus.openAt)}. Potrai ordinare da quell'orario.`}
          {orderingStatus.reason === "past_cutoff" && `Gli ordini per oggi sono chiusi (chiusura alle ${fmtTime(orderingStatus.closeAt)}). Puoi comunque guardare il menu.`}
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight mb-1">Cosa ti portiamo?</h1>
      <p className="text-sm text-stone-500 mb-6">Ordina dal tuo posto. Il bar prepara e ti avvisa.</p>

      {categories.map((cat) => {
        const items = products.filter((p) => p.category_id === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-7">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">{cat.name}</h2>
            <div className="space-y-2">
              {items.map((p) => (
                <div key={p.id} className={`flex items-center justify-between border rounded-xl px-4 py-3 ${p.available ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60"}`}>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-stone-500">
                      €{Number(p.price).toFixed(2)}
                      {!p.available && <span className="ml-2 text-rose-600 font-medium">Non disponibile</span>}
                    </div>
                  </div>
                  {p.available ? (
                    cart[p.id] ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => addQty(p.id, -1)} className="h-7 w-7 grid place-items-center rounded-full border border-stone-300"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums">{cart[p.id]}</span>
                        <button onClick={() => addQty(p.id, 1)} className="h-7 w-7 grid place-items-center rounded-full bg-stone-900 text-white"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => addQty(p.id, 1)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-900 text-white">Aggiungi</button>
                    )
                  ) : (
                    <Ban className="h-4 w-4 text-stone-300" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {cartItems.length > 0 && orderingStatus.open && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-stone-900 text-white rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-stone-300">{cartItems.length} prodott{cartItems.length === 1 ? "o" : "i"} nel carrello</span>
            <span className="font-bold text-lg tabular-nums">€{total.toFixed(2)}</span>
          </div>
          <button onClick={() => setCheckoutOpen(true)} className="w-full bg-orange-700 hover:bg-orange-600 transition rounded-lg py-3 font-semibold text-sm">
            Continua
          </button>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          table={table} zone={zone}
          mode={mode} setMode={setMode}
          note={note} setNote={setNote}
          requestedTime={requestedTime} setRequestedTime={setRequestedTime}
          timeSlots={timeSlots}
          total={total}
          customer={customer} saveCustomer={saveCustomer}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={handleSubmit}
          submitting={submitting} error={error}
        />
      )}
    </div>
  );
}

function CheckoutSheet({ table, zone, mode, setMode, note, setNote, requestedTime, setRequestedTime, timeSlots, total, customer, saveCustomer, onClose, onSubmit, submitting, error }) {
  const [form, setForm] = useState(customer || { name: "", email: "", phone: "" });

  function handleConfirmDetails() {
    if (!form.name.trim() || !form.phone.trim()) return;
    saveCustomer({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Ultimo passo</h2>
          <button onClick={onClose} className="text-stone-400 text-sm">Chiudi</button>
        </div>

        {!customer ? (
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">I tuoi dati</div>
            <div className="space-y-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome e cognome" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Numero di telefono" type="tel" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (facoltativa)" type="email" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <button onClick={handleConfirmDetails} disabled={!form.name.trim() || !form.phone.trim()} className="w-full bg-stone-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-40">
                Conferma dati
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">{customer.name}</div>
              <div className="text-xs text-stone-500">{customer.phone}</div>
            </div>
            <button onClick={() => saveCustomer(null)} className="text-xs font-semibold text-stone-500">Cambia</button>
          </div>
        )}

        {customer && (
          <>
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Come lo vuoi</div>
              <div className="flex gap-2">
                <button onClick={() => setMode("ritiro")} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border ${mode === "ritiro" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600"}`}>
                  <ShoppingBag className="h-3.5 w-3.5" /> Ritiro al bar
                </button>
                <button onClick={() => setMode("consegna")} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border ${mode === "consegna" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600"}`}>
                  <Bike className="h-3.5 w-3.5" /> Consegna {Number(zone?.surcharge) > 0 && `(+€${Number(zone.surcharge).toFixed(2)})`}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> A che ora lo vuoi
              </div>
              <select value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2">
                <option value="asap">Il prima possibile</option>
                {timeSlots.map((t) => (
                  <option key={t.toISOString()} value={t.toISOString()}>
                    Alle {t.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </option>
                ))}
              </select>
            </div>

            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note per il bar (es. senza ghiaccio)" className="w-full mb-4 text-sm border border-stone-300 rounded-lg px-3 py-2" />

            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-stone-500">Totale da pagare {mode === "consegna" ? "alla consegna" : "al ritiro"}</span>
              <span className="font-bold text-lg tabular-nums">€{total.toFixed(2)}</span>
            </div>
            {error && <div className="text-rose-600 text-xs mb-2">{error}</div>}
            <button disabled={submitting} onClick={onSubmit} className="w-full bg-orange-700 hover:bg-orange-600 transition rounded-lg py-3 font-semibold text-sm text-white disabled:opacity-50">
              {submitting ? "Invio…" : `Invia ordine · ${table.label}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OrderTrackView({ order, table, zone, onBack }) {
  const steps = ["in_attesa", "accettato", "pronto", "completato"];
  const stepLabels = {
    in_attesa: "Inviato",
    accettato: "Accettato dal bar",
    pronto: order.type === "ritiro" ? "Pronto per il ritiro" : "In consegna",
    completato: order.type === "ritiro" ? "Ritirato" : "Consegnato",
  };
  const currentIndex = Math.max(0, steps.indexOf(order.status === "rifiutato" ? "in_attesa" : order.status));

  return (
    <div className="max-w-md mx-auto px-4 pt-10 text-center">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft className="h-4 w-4" /> Nuovo ordine
      </button>
      <div className="text-6xl font-black tracking-tighter tabular-nums mb-1">{order.code}</div>
      <div className="text-sm text-stone-500 mb-1">{table.label} · {zone?.name}</div>
      <div className="text-sm text-stone-500 mb-8">
        {order.requested_time
          ? `Richiesto per le ${new Date(order.requested_time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
          : "Il prima possibile"}
      </div>

      {order.status === "rifiutato" ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm font-medium">
          Il bar non può accettare questo ordine ora. Riprova tra qualche minuto.
        </div>
      ) : (
        <div>
          {steps.map((s, i) => (
            <div key={s} className="flex items-start gap-3 text-left">
              <div className="flex flex-col items-center">
                <div className={`h-7 w-7 rounded-full grid place-items-center border-2 ${i <= currentIndex ? "bg-stone-900 border-stone-900 text-white" : "border-stone-300 text-stone-300"}`}>
                  {i < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                {i < steps.length - 1 && <div className={`w-0.5 h-8 ${i < currentIndex ? "bg-stone-900" : "bg-stone-200"}`} />}
              </div>
              <div className={`pb-8 pt-1 text-sm font-medium ${i <= currentIndex ? "text-stone-900" : "text-stone-400"}`}>{stepLabels[s]}</div>
            </div>
          ))}
        </div>
      )}

      <div className="text-left bg-white border border-stone-200 rounded-xl p-4 mt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Riepilogo</div>
        {order.items?.map((it, i) => (
          <div key={i} className="flex justify-between text-sm py-0.5">
            <span>{it.qty}× {it.name}</span>
            <span className="tabular-nums">€{(Number(it.price) * it.qty).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-stone-100 mt-2 pt-2 flex justify-between text-sm font-bold">
          <span>Totale</span><span className="tabular-nums">€{Number(order.total).toFixed(2)}</span>
        </div>
        <div className="text-xs text-stone-400 mt-2">Pagamento in contanti/carta al {order.type === "ritiro" ? "ritiro" : "momento della consegna"}.</div>
      </div>
    </div>
  );
}

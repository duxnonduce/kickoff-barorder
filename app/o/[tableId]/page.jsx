"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Minus, ShoppingBag, Bike, Ban, ArrowLeft, CheckCircle2 } from "lucide-react";

const ZONE_STYLE = {
  piscina: { text: "text-teal-800", soft: "bg-teal-50", border: "border-teal-200" },
  campi: { text: "text-orange-800", soft: "bg-orange-50", border: "border-orange-200" },
  bar: { text: "text-stone-800", soft: "bg-stone-100", border: "border-stone-300" },
};

export default function OrderPage() {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [zone, setZone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState("ritiro");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

  // Realtime: se il bar disattiva un prodotto mentre sto ordinando
  useEffect(() => {
    const channel = supabase
      .channel("products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
        setProducts((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Realtime: stato del mio ordine dopo l'invio
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

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          table_id: table.id,
          zone_id: zone.id,
          type: mode,
          total,
          note: note || null,
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
      <div className={`flex items-center gap-2 mb-6 px-3 py-2 rounded-lg border ${zs.soft} ${zs.border}`}>
        <span className={`text-sm font-semibold ${zs.text}`}>{table.label}</span>
        <span className="text-xs text-stone-500">· {zone?.name}</span>
      </div>

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

      {cartItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-stone-900 text-white rounded-2xl p-4 shadow-xl">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setMode("ritiro")} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border ${mode === "ritiro" ? "bg-white text-stone-900 border-white" : "border-stone-600 text-stone-300"}`}>
              <ShoppingBag className="h-3.5 w-3.5" /> Ritiro al bar
            </button>
            <button onClick={() => setMode("consegna")} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border ${mode === "consegna" ? "bg-white text-stone-900 border-white" : "border-stone-600 text-stone-300"}`}>
              <Bike className="h-3.5 w-3.5" /> Consegna {Number(zone?.surcharge) > 0 && `(+€${Number(zone.surcharge).toFixed(2)})`}
            </button>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note per il bar (es. senza ghiaccio)" className="w-full mb-3 text-sm bg-stone-800 placeholder-stone-400 rounded-lg px-3 py-2 outline-none" />
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-stone-300">Totale da pagare {mode === "consegna" ? "alla consegna" : "al ritiro"}</span>
            <span className="font-bold text-lg tabular-nums">€{total.toFixed(2)}</span>
          </div>
          {error && <div className="text-rose-300 text-xs mb-2">{error}</div>}
          <button disabled={submitting} onClick={handleSubmit} className="w-full bg-orange-700 hover:bg-orange-600 transition rounded-lg py-3 font-semibold text-sm disabled:opacity-50">
            {submitting ? "Invio…" : `Invia ordine · ${table.label}`}
          </button>
        </div>
      )}
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
      <div className="text-sm text-stone-500 mb-8">{table.label} · {zone?.name}</div>

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

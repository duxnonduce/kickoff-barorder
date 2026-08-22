"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Minus, ShoppingBag, Bike, Ban, ArrowLeft, CheckCircle2, Clock, Megaphone, Heart, RotateCcw, StickyNote, X, Trash2, SlidersHorizontal } from "lucide-react";

const ZONE_STYLE = {
  piscina: { text: "text-teal-800", soft: "bg-teal-50", border: "border-teal-200" },
  campi: { text: "text-orange-800", soft: "bg-orange-50", border: "border-orange-200" },
  bar: { text: "text-stone-800", soft: "bg-stone-100", border: "border-stone-300" },
};

const CUSTOMER_STORAGE_KEY = "kickoff_customer";

function newId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function generateTimeSlots(todayHours) {
  if (!todayHours || todayHours.closed) return [];
  const now = new Date();
  const [oh, om] = todayHours.open_time.slice(0, 5).split(":").map(Number);
  const [ch, cm] = todayHours.close_time.slice(0, 5).split(":").map(Number);
  const openAt = new Date(now); openAt.setHours(oh, om, 0, 0);
  const closeAt = new Date(now); closeAt.setHours(ch, cm, 0, 0);
  const cutoffAt = new Date(closeAt.getTime() - 15 * 60000);

  const earliestPossible = new Date(now.getTime() + 20 * 60000);
  let next = new Date(Math.max(earliestPossible.getTime(), openAt.getTime()));
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);

  const slots = [];
  while (next <= cutoffAt && slots.length < 24) {
    slots.push(new Date(next));
    next = new Date(next.getTime() + 15 * 60000);
  }
  return slots;
}

function isInTimeWindow(from, until) {
  if (!from && !until) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
  const f = from ? toMin(from) : 0;
  const u = until ? toMin(until) : 24 * 60;
  return nowMin >= f && nowMin <= u;
}

function isHappyHourActive(product) {
  return product?.happy_price != null && isInTimeWindow(product.happy_from, product.happy_until);
}

function effectivePrice(product) {
  if (!product) return 0;
  return isHappyHourActive(product) ? Number(product.happy_price) : Number(product.price);
}

function lineUnitPrice(line, product) {
  const optTotal = (line.options || []).reduce((s, o) => s + Number(o.price_delta || 0), 0);
  return effectivePrice(product) + optTotal;
}

export default function OrderPage() {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [zone, setZone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [optionGroups, setOptionGroups] = useState({}); // { productId: [group, ...] }
  const [cartLines, setCartLines] = useState([]); // [{ id, productId, qty, options:[{id,name,price_delta,group_name}], note }]
  const [mode, setMode] = useState("ritiro");
  const [note, setNote] = useState("");
  const [requestedTime, setRequestedTime] = useState("asap");
  const [loading, setLoading] = useState(true);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [todayHours, setTodayHours] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [clientRequestId, setClientRequestId] = useState(() => newId());
  const [favorites, setFavorites] = useState([]);
  const [openNoteFor, setOpenNoteFor] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [reorderDismissed, setReorderDismissed] = useState(false);
  const [customizeProduct, setCustomizeProduct] = useState(null);
  const [dietFilters, setDietFilters] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // { code, discount_amount, message }
  const [couponError, setCouponError] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [topProductIds, setTopProductIds] = useState([]);

  const timeSlots = useMemo(() => generateTimeSlots(todayHours), [todayHours]);

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

    fetch("/api/top-products").then((r) => r.json()).then((d) => setTopProductIds(d.productIds || [])).catch(() => {});
  }, []);

  const orderingStatus = useMemo(() => {
    if (!todayHours) return { open: true };
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
    if (!customer?.phone) return;
    async function loadCustomerData() {
      const { data: cust } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", customer.phone)
        .maybeSingle();
      if (!cust) return;
      setFavorites(cust.favorite_product_ids || []);

      const { data: last } = await supabase
        .from("orders")
        .select("*, order_items(*, order_item_options(*))")
        .eq("customer_id", cust.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) setLastOrder(last);
    }
    loadCustomerData();
  }, [customer?.phone]);

  async function toggleFavorite(productId) {
    if (!customer?.phone) return;
    const isFav = favorites.includes(productId);
    setFavorites((prev) => (isFav ? prev.filter((id) => id !== productId) : [...prev, productId]));
    try {
      await fetch("/api/customers/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone, product_id: productId, action: isFav ? "remove" : "add" }),
      });
    } catch {
      setFavorites((prev) => (isFav ? [...prev, productId] : prev.filter((id) => id !== productId)));
    }
  }

  function reorderLast() {
    if (!lastOrder) return;
    const nextLines = [];
    lastOrder.order_items.forEach((it) => {
      const product = products.find((p) => p.id === it.product_id && p.available);
      if (!product) return;
      nextLines.push({
        id: newId(),
        productId: it.product_id,
        qty: it.qty,
        options: (it.order_item_options || []).map((o) => ({ id: newId(), name: o.option_name, price_delta: o.price_delta, group_name: o.group_name })),
        note: it.note || "",
      });
    });
    setCartLines(nextLines);
    setReorderDismissed(true);
  }

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from("tables").select("*").eq("id", tableId).single();
      if (!t || t.archived_at) { setLoading(false); return; }
      setTable(t);
      const { data: z } = await supabase.from("zones").select("*").eq("id", t.zone_id).single();
      setZone(z);
      const { data: cats } = await supabase.from("categories").select("*").order("sort_order");
      setCategories(cats || []);
      const { data: prods } = await supabase.from("products").select("*").order("name");
      setProducts(prods || []);

      const { data: groups } = await supabase
        .from("product_option_groups")
        .select("*, product_options(*)")
        .order("sort_order");
      const grouped = {};
      (groups || []).forEach((g) => {
        if (!grouped[g.product_id]) grouped[g.product_id] = [];
        grouped[g.product_id].push({ ...g, product_options: (g.product_options || []).sort((a, b) => a.sort_order - b.sort_order) });
      });
      setOptionGroups(grouped);

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
        setPlacedOrder((prev) => {
          if (prev && prev.status !== "pronto" && payload.new.status === "pronto") playReadyAlert();
          return { ...prev, ...payload.new };
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [placedOrder?.id]);

  function playReadyAlert() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  // ---------- Carrello ----------

  function addSimple(product) {
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && (l.options || []).length === 0);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: newId(), productId: product.id, qty: 1, options: [], note: "" }];
    });
  }

  function decrementSimple(product) {
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && (l.options || []).length === 0);
      if (idx < 0) return prev;
      const next = [...prev];
      if (next[idx].qty <= 1) { next.splice(idx, 1); return next; }
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      return next;
    });
  }

  function addCustomizedLine(product, options, qty, lineNote) {
    setCartLines((prev) => [...prev, { id: newId(), productId: product.id, qty, options, note: lineNote }]);
  }

  function updateLineQty(lineId, delta) {
    setCartLines((prev) => {
      const next = [];
      for (const l of prev) {
        if (l.id !== lineId) { next.push(l); continue; }
        const q = l.qty + delta;
        if (q > 0) next.push({ ...l, qty: q });
      }
      return next;
    });
  }

  function removeLine(lineId) {
    setCartLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function setLineNote(lineId, text) {
    setCartLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, note: text } : l)));
  }

  const cartTotalQty = cartLines.reduce((s, l) => s + l.qty, 0);
  const subtotal = cartLines.reduce((s, l) => {
    const product = products.find((p) => p.id === l.productId);
    return s + lineUnitPrice(l, product) * l.qty;
  }, 0);
  const surcharge = mode === "consegna" ? Number(zone?.surcharge || 0) : 0;
  const discount = couponApplied?.discount_amount || 0;
  const total = Math.max(0, subtotal + surcharge - discount);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponApplied({ code: data.code, discount_amount: data.discount_amount, message: data.message });
        setCouponError(null);
      } else {
        setCouponApplied(null);
        setCouponError(data.message || "Codice non valido");
      }
    } catch {
      setCouponError("Non sono riuscito a verificare il codice.");
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError(null);
  }

  function saveCustomer(info) {
    setCustomer(info);
    if (typeof window !== "undefined") {
      if (info) window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
      else window.localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    }
  }

  async function handleSubmit() {
    if (cartLines.length === 0 || !customer || submitting) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("Connessione assente. Il tuo ordine non è ancora stato inviato — riprova quando torni online.");
      return;
    }
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

      let order, orderErr;
      ({ data: order, error: orderErr } = await supabase
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
          client_request_id: clientRequestId,
          coupon_code: couponApplied?.code || null,
          discount_amount: discount,
        })
        .select()
        .single());

      if (orderErr && orderErr.code === "23505") {
        const { data: existing } = await supabase
          .from("orders")
          .select("*, order_items(*, order_item_options(*))")
          .eq("client_request_id", clientRequestId)
          .single();
        if (existing) {
          setPlacedOrder({ ...existing, items: existing.order_items });
          resetCartAfterSubmit();
          return;
        }
      }
      if (orderErr) throw orderErr;

      const rows = cartLines.map((l) => {
        const product = products.find((p) => p.id === l.productId);
        return {
          order_id: order.id,
          product_id: product.id,
          name: product.name,
          price: lineUnitPrice(l, product),
          qty: l.qty,
          note: l.note || null,
          station: product.station || "bar",
          prep_min: product.prep_min || 5,
        };
      });
      const { data: insertedItems, error: itemsErr } = await supabase.from("order_items").insert(rows).select();
      if (itemsErr) throw itemsErr;

      const optionRows = [];
      insertedItems.forEach((row, idx) => {
        const line = cartLines[idx];
        (line.options || []).forEach((o) => {
          optionRows.push({
            order_item_id: row.id,
            group_name: o.group_name,
            option_name: o.name,
            price_delta: o.price_delta,
          });
        });
      });
      if (optionRows.length > 0) {
        await supabase.from("order_item_options").insert(optionRows);
      }

      const itemsWithOptions = insertedItems.map((row, idx) => ({
        ...row,
        order_item_options: (cartLines[idx].options || []).map((o) => ({ group_name: o.group_name, option_name: o.name, price_delta: o.price_delta })),
      }));

      setPlacedOrder({ ...order, items: itemsWithOptions });
      resetCartAfterSubmit();
    } catch (e) {
      setError("Non sono riuscito a inviare l'ordine. Riprova.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  function resetCartAfterSubmit() {
    if (couponApplied?.code) {
      fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponApplied.code }),
      }).catch(() => {});
    }
    setCartLines([]);
    setNote("");
    setCheckoutOpen(false);
    setClientRequestId(newId());
    setCouponApplied(null);
    setCouponCode("");
    setCouponError(null);
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-stone-400 text-sm">Carico il menu…</div>;
  if (!table) return <div className="min-h-screen grid place-items-center text-stone-400 text-sm px-6 text-center">Postazione non trovata. Controlla il QR code.</div>;

  if (placedOrder) {
    return <OrderTrackView order={placedOrder} table={table} zone={zone} onBack={() => setPlacedOrder(null)} />;
  }

  const zs = ZONE_STYLE[zone?.type] || ZONE_STYLE.bar;

  function isTimeVisible(p) {
    if (!p.visible_from && !p.visible_until) return true;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toMin = (t) => { const [h, m] = t.slice(0, 5).split(":").map(Number); return h * 60 + m; };
    const from = p.visible_from ? toMin(p.visible_from) : 0;
    const until = p.visible_until ? toMin(p.visible_until) : 24 * 60;
    return nowMin >= from && nowMin <= until;
  }

  function matchesDietFilters(p) {
    return dietFilters.every((key) => p[key]);
  }

  function visibleProductsOf(list) {
    return list.filter((p) => isTimeVisible(p) && matchesDietFilters(p));
  }

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

      {lastOrder && !reorderDismissed && orderingStatus.open && cartLines.length === 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <RotateCcw className="h-4 w-4 text-stone-400 shrink-0" />
            <div className="text-sm text-stone-700 truncate">
              Vuoi <b>riordinare</b> il tuo ultimo ordine ({lastOrder.order_items.length} prodott{lastOrder.order_items.length === 1 ? "o" : "i"})?
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={reorderLast} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-900 text-white">Riordina</button>
            <button onClick={() => setReorderDismissed(true)} className="text-xs text-stone-400">No grazie</button>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight mb-1">Cosa ti portiamo?</h1>
      <p className="text-sm text-stone-500 mb-4">Ordina dal tuo posto. Il bar prepara e ti avvisa.</p>

      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
        <SlidersHorizontal className="h-3.5 w-3.5 text-stone-300 shrink-0" />
        {[
          { key: "tag_vegetarian", label: "🌱 Vegetariano" },
          { key: "tag_vegan", label: "🌿 Vegano" },
          { key: "tag_gluten_free", label: "🌾 Senza glutine" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setDietFilters((prev) => prev.includes(f.key) ? prev.filter((k) => k !== f.key) : [...prev, f.key])}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 ${dietFilters.includes(f.key) ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {topProductIds.length > 0 && (() => {
        const topProducts = visibleProductsOf(
          topProductIds.map((id) => products.find((p) => p.id === id)).filter((p) => p && p.available)
        );
        if (topProducts.length === 0) return null;
        return (
          <div className="mb-7">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1.5">
              🔥 I più ordinati di KickOff
            </h2>
            <div className="space-y-2">
              {topProducts.map((p) => (
                <ProductRow key={p.id} p={p} cartLines={cartLines} addSimple={addSimple} decrementSimple={decrementSimple}
                  optionGroups={optionGroups[p.id]} onCustomize={() => setCustomizeProduct(p)}
                  customer={customer} favorites={favorites} toggleFavorite={toggleFavorite}
                  openNoteFor={openNoteFor} setOpenNoteFor={setOpenNoteFor} setLineNote={setLineNote} />
              ))}
            </div>
          </div>
        );
      })()}

      {customer && favorites.length > 0 && (() => {
        const favProducts = visibleProductsOf(products.filter((p) => favorites.includes(p.id) && p.available));
        if (favProducts.length === 0) return null;
        return (
          <div className="mb-7">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1.5">
              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> I tuoi preferiti
            </h2>
            <div className="space-y-2">
              {favProducts.map((p) => (
                <ProductRow key={p.id} p={p} cartLines={cartLines} addSimple={addSimple} decrementSimple={decrementSimple}
                  optionGroups={optionGroups[p.id]} onCustomize={() => setCustomizeProduct(p)}
                  customer={customer} favorites={favorites} toggleFavorite={toggleFavorite}
                  openNoteFor={openNoteFor} setOpenNoteFor={setOpenNoteFor} setLineNote={setLineNote} />
              ))}
            </div>
          </div>
        );
      })()}

      {categories.map((cat) => {
        const items = visibleProductsOf(products.filter((p) => p.category_id === cat.id));
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="mb-7">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">{cat.name}</h2>
            <div className="space-y-2">
              {items.map((p) => (
                <ProductRow key={p.id} p={p} cartLines={cartLines} addSimple={addSimple} decrementSimple={decrementSimple}
                  optionGroups={optionGroups[p.id]} onCustomize={() => setCustomizeProduct(p)}
                  customer={customer} favorites={favorites} toggleFavorite={toggleFavorite}
                  openNoteFor={openNoteFor} setOpenNoteFor={setOpenNoteFor} setLineNote={setLineNote} />
              ))}
            </div>
          </div>
        );
      })}

      {cartLines.length > 0 && orderingStatus.open && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-stone-900 text-white rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-stone-300">{cartTotalQty} prodott{cartTotalQty === 1 ? "o" : "i"} nel carrello</span>
            <span className="font-bold text-lg tabular-nums">€{total.toFixed(2)}</span>
          </div>
          <button onClick={() => setCheckoutOpen(true)} className="w-full bg-orange-700 hover:bg-orange-600 transition rounded-lg py-3 font-semibold text-sm">
            Continua
          </button>
        </div>
      )}

      {customizeProduct && (
        <CustomizeSheet
          product={customizeProduct}
          groups={optionGroups[customizeProduct.id] || []}
          onClose={() => setCustomizeProduct(null)}
          onAdd={(options, qty, lineNote) => { addCustomizedLine(customizeProduct, options, qty, lineNote); setCustomizeProduct(null); }}
        />
      )}

      {checkoutOpen && (
        <CheckoutSheet
          table={table} zone={zone}
          mode={mode} setMode={setMode}
          note={note} setNote={setNote}
          requestedTime={requestedTime} setRequestedTime={setRequestedTime}
          timeSlots={timeSlots}
          total={total} subtotal={subtotal} surcharge={surcharge}
          cartLines={cartLines} products={products}
          updateLineQty={updateLineQty} removeLine={removeLine}
          customer={customer} saveCustomer={saveCustomer}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={handleSubmit}
          submitting={submitting} error={error}
          couponCode={couponCode} setCouponCode={setCouponCode}
          couponApplied={couponApplied} applyCoupon={applyCoupon} removeCoupon={removeCoupon}
          couponError={couponError} couponChecking={couponChecking}
        />
      )}
    </div>
  );
}

// ---------- Riga prodotto nel menu ----------

const TAG_BADGES = {
  tag_vegetarian: "🌱",
  tag_vegan: "🌿",
  tag_gluten_free: "🌾",
  tag_spicy: "🌶️",
  tag_recommended: "⭐",
  tag_new: "🆕",
  tag_bestseller: "🔥",
};

function ProductRow({ p, cartLines, addSimple, decrementSimple, optionGroups, onCustomize, customer, favorites, toggleFavorite, openNoteFor, setOpenNoteFor, setLineNote }) {
  const isFav = favorites.includes(p.id);
  const hasGroups = (optionGroups || []).length > 0;
  const simpleLine = cartLines.find((l) => l.productId === p.id && (l.options || []).length === 0);
  const totalQtyInCart = cartLines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
  const noteOpen = simpleLine && openNoteFor === simpleLine.id;
  const badges = Object.entries(TAG_BADGES).filter(([key]) => p[key]).map(([, emoji]) => emoji);
  const lowStock = p.track_stock && p.available && (p.stock_qty ?? 0) <= p.low_stock_threshold;

  return (
    <div className={`border rounded-xl px-4 py-3 ${p.available ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {customer && (
            <button onClick={() => toggleFavorite(p.id)} className="shrink-0 mt-0.5">
              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-stone-300"}`} />
            </button>
          )}
          {p.image_url && (
            <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 bg-stone-100" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {p.name} {badges.length > 0 && <span className="ml-1">{badges.join(" ")}</span>}
            </div>
            {p.description && <div className="text-xs text-stone-400 truncate">{p.description}</div>}
            <div className="text-xs text-stone-500">
              {isHappyHourActive(p) ? (
                <span>
                  <span className="line-through text-stone-300 mr-1">€{Number(p.price).toFixed(2)}</span>
                  <span className="text-orange-700 font-semibold">€{Number(p.happy_price).toFixed(2)} 🔥</span>
                </span>
              ) : (
                <span>€{Number(p.price).toFixed(2)}</span>
              )}
              {hasGroups && <span className="text-stone-400"> +</span>}
              {!p.available && (
                <span className="ml-2 text-rose-600 font-medium">{p.unavailable_note || "Non disponibile"}</span>
              )}
              {p.available && lowStock && <span className="ml-2 text-amber-600 font-medium">Ne restano {p.stock_qty}</span>}
              {p.available && hasGroups && totalQtyInCart > 0 && <span className="ml-2 text-emerald-700 font-medium">Nel carrello: {totalQtyInCart}</span>}
            </div>
          </div>
        </div>
        {p.available ? (
          hasGroups ? (
            <button onClick={onCustomize} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-900 text-white shrink-0">
              {totalQtyInCart > 0 ? "Aggiungi altro" : "Personalizza"}
            </button>
          ) : simpleLine ? (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => decrementSimple(p)} className="h-7 w-7 grid place-items-center rounded-full border border-stone-300"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-5 text-center text-sm font-semibold tabular-nums">{simpleLine.qty}</span>
              <button onClick={() => addSimple(p)} className="h-7 w-7 grid place-items-center rounded-full bg-stone-900 text-white"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => addSimple(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-900 text-white shrink-0">Aggiungi</button>
          )
        ) : (
          <Ban className="h-4 w-4 text-stone-300 shrink-0" />
        )}
      </div>

      {simpleLine && (
        <div className="mt-2">
          {noteOpen ? (
            <input
              autoFocus
              value={simpleLine.note}
              onChange={(e) => setLineNote(simpleLine.id, e.target.value)}
              onBlur={() => setOpenNoteFor(null)}
              placeholder="Es. senza ghiaccio…"
              className="w-full text-xs border border-stone-300 rounded-lg px-2.5 py-1.5"
            />
          ) : (
            <button onClick={() => setOpenNoteFor(simpleLine.id)} className="flex items-center gap-1 text-xs text-stone-400">
              <StickyNote className="h-3 w-3" />
              {simpleLine.note || "Aggiungi nota"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Sheet di personalizzazione (varianti/aggiunte) ----------

function CustomizeSheet({ product, groups, onClose, onAdd }) {
  const [selected, setSelected] = useState(() => {
    const init = {};
    groups.forEach((g) => {
      init[g.id] = g.selection_type === "multiple" ? [] : (g.required && g.product_options[0] ? g.product_options[0].id : null);
    });
    return init;
  });
  const [qty, setQty] = useState(1);
  const [lineNote, setLineNote] = useState("");

  function pickSingle(groupId, optionId) {
    setSelected((prev) => ({ ...prev, [groupId]: optionId }));
  }
  function toggleMultiple(groupId, optionId) {
    setSelected((prev) => {
      const cur = prev[groupId] || [];
      const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
      return { ...prev, [groupId]: next };
    });
  }

  const missingRequired = groups.some((g) => g.required && (
    g.selection_type === "multiple" ? (selected[g.id] || []).length === 0 : !selected[g.id]
  ));

  const chosenOptions = [];
  groups.forEach((g) => {
    const opts = g.product_options || [];
    if (g.selection_type === "multiple") {
      (selected[g.id] || []).forEach((optId) => {
        const o = opts.find((x) => x.id === optId);
        if (o) chosenOptions.push({ id: o.id, name: o.name, price_delta: Number(o.price_delta), group_name: g.name });
      });
    } else if (selected[g.id]) {
      const o = opts.find((x) => x.id === selected[g.id]);
      if (o) chosenOptions.push({ id: o.id, name: o.name, price_delta: Number(o.price_delta), group_name: g.name });
    }
  });

  const unitPrice = effectivePrice(product) + chosenOptions.reduce((s, o) => s + o.price_delta, 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">{product.name}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-stone-400" /></button>
        </div>
        <p className="text-sm text-stone-500 mb-4">€{Number(product.price).toFixed(2)}</p>

        {groups.map((g) => (
          <div key={g.id} className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
              {g.name} {g.required && <span className="text-rose-500">*</span>}
            </div>
            <div className="space-y-1.5">
              {(g.product_options || []).map((o) => {
                const checked = g.selection_type === "multiple" ? (selected[g.id] || []).includes(o.id) : selected[g.id] === o.id;
                return (
                  <label key={o.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm cursor-pointer ${checked ? "border-stone-900 bg-stone-50" : "border-stone-200"}`}>
                    <span className="flex items-center gap-2">
                      <input
                        type={g.selection_type === "multiple" ? "checkbox" : "radio"}
                        name={g.id}
                        checked={checked}
                        onChange={() => g.selection_type === "multiple" ? toggleMultiple(g.id, o.id) : pickSingle(g.id, o.id)}
                      />
                      {o.name}
                    </span>
                    {Number(o.price_delta) > 0 && <span className="text-xs text-stone-500">+€{Number(o.price_delta).toFixed(2)}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <input
          value={lineNote}
          onChange={(e) => setLineNote(e.target.value)}
          placeholder="Note (es. ben cotto, senza cipolla…)"
          className="w-full mb-4 text-sm border border-stone-300 rounded-lg px-3 py-2"
        />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-stone-500">Quantità</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-7 w-7 grid place-items-center rounded-full border border-stone-300"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="h-7 w-7 grid place-items-center rounded-full bg-stone-900 text-white"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <button
          disabled={missingRequired}
          onClick={() => onAdd(chosenOptions, qty, lineNote)}
          className="w-full bg-orange-700 text-white text-sm font-semibold rounded-lg py-3 disabled:opacity-40"
        >
          Aggiungi al carrello · €{(unitPrice * qty).toFixed(2)}
        </button>
      </div>
    </div>
  );
}

// ---------- Checkout ----------

function CheckoutSheet({ table, zone, mode, setMode, note, setNote, requestedTime, setRequestedTime, timeSlots, total, subtotal, surcharge, cartLines, products, updateLineQty, removeLine, customer, saveCustomer, onClose, onSubmit, submitting, error, couponCode, setCouponCode, couponApplied, applyCoupon, removeCoupon, couponError, couponChecking }) {
  const [form, setForm] = useState(customer || { name: "", email: "", phone: "" });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  function handleConfirmDetails() {
    if (!form.name.trim() || !form.phone.trim() || !privacyAccepted) return;
    saveCustomer({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      privacyAccepted: true,
      marketingConsent,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Il tuo ordine</h2>
          <button onClick={onClose} className="text-stone-400 text-sm">Chiudi</button>
        </div>

        <div className="mb-5 space-y-2">
          {cartLines.map((l) => {
            const product = products.find((p) => p.id === l.productId);
            if (!product) return null;
            const unit = lineUnitPrice(l, product);
            return (
              <div key={l.id} className="border border-stone-200 rounded-lg px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{product.name}</div>
                    {l.options?.length > 0 && (
                      <div className="text-xs text-stone-500">{l.options.map((o) => o.name).join(", ")}</div>
                    )}
                    {l.note && <div className="text-xs text-stone-400 italic">{l.note}</div>}
                  </div>
                  <button onClick={() => removeLine(l.id)} className="text-stone-300 hover:text-rose-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateLineQty(l.id, -1)} className="h-6 w-6 grid place-items-center rounded-full border border-stone-300"><Minus className="h-3 w-3" /></button>
                    <span className="w-4 text-center text-xs font-semibold tabular-nums">{l.qty}</span>
                    <button onClick={() => updateLineQty(l.id, 1)} className="h-6 w-6 grid place-items-center rounded-full bg-stone-900 text-white"><Plus className="h-3 w-3" /></button>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">€{(unit * l.qty).toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {!customer ? (
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">I tuoi dati</div>
            <div className="space-y-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome e cognome" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Numero di telefono" type="tel" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (facoltativa)" type="email" className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2" />

              <label className="flex items-start gap-2 pt-1 text-xs text-stone-600">
                <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-0.5" />
                <span>Ho letto e accetto l'<a href="/privacy" target="_blank" className="underline">informativa privacy</a> per il trattamento dei miei dati necessari a gestire l'ordine. *</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-0.5" />
                <span>Voglio ricevere comunicazioni su offerte e novità (facoltativo).</span>
              </label>

              <button onClick={handleConfirmDetails} disabled={!form.name.trim() || !form.phone.trim() || !privacyAccepted} className="w-full bg-stone-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-40">
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

            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note generali per il bar" className="w-full mb-4 text-sm border border-stone-300 rounded-lg px-3 py-2" />

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Hai un codice sconto?</div>
              {couponApplied ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div className="text-sm text-emerald-800">
                    <span className="font-mono font-semibold">{couponApplied.code}</span> — {couponApplied.message}
                  </div>
                  <button onClick={removeCoupon} className="text-xs font-semibold text-emerald-700">Rimuovi</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Es. ESTATE10"
                    className="flex-1 text-sm border border-stone-300 rounded-lg px-3 py-2 uppercase"
                  />
                  <button onClick={applyCoupon} disabled={couponChecking || !couponCode.trim()} className="text-sm font-semibold px-4 rounded-lg bg-stone-900 text-white disabled:opacity-40">
                    {couponChecking ? "…" : "Applica"}
                  </button>
                </div>
              )}
              {couponError && <div className="text-rose-600 text-xs mt-1.5">{couponError}</div>}
            </div>

            <div className="mb-3 text-sm space-y-1">
              <div className="flex items-center justify-between text-stone-500">
                <span>Subtotale</span>
                <span className="tabular-nums">€{subtotal.toFixed(2)}</span>
              </div>
              {surcharge > 0 && (
                <div className="flex items-center justify-between text-stone-500">
                  <span>Consegna</span>
                  <span className="tabular-nums">€{surcharge.toFixed(2)}</span>
                </div>
              )}
              {couponApplied && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Sconto {couponApplied.code}</span>
                  <span className="tabular-nums">−€{couponApplied.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-bold text-base pt-1 border-t border-stone-100">
                <span>Totale da pagare {mode === "consegna" ? "alla consegna" : "al ritiro"}</span>
                <span className="tabular-nums">€{total.toFixed(2)}</span>
              </div>
            </div>
            {error && <div className="text-rose-600 text-xs mb-2">{error}</div>}
            <button disabled={submitting || cartLines.length === 0} onClick={onSubmit} className="w-full bg-orange-700 hover:bg-orange-600 transition rounded-lg py-3 font-semibold text-sm text-white disabled:opacity-50">
              {submitting ? "Invio…" : `Invia ordine · ${table.label}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Tracking ordine ----------

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
          {order.reject_reason
            ? `Il bar non può accettare questo ordine ora: ${order.reject_reason.toLowerCase()}.`
            : "Il bar non può accettare questo ordine ora. Riprova tra qualche minuto."}
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
          <div key={i} className="py-0.5">
            <div className="flex justify-between text-sm">
              <span>{it.qty}× {it.name}</span>
              <span className="tabular-nums">€{(Number(it.price) * it.qty).toFixed(2)}</span>
            </div>
            {it.order_item_options?.length > 0 && (
              <div className="text-xs text-stone-500">{it.order_item_options.map((o) => o.option_name).join(", ")}</div>
            )}
            {it.note && <div className="text-xs text-stone-400 italic">{it.note}</div>}
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

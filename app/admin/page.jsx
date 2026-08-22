"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import PinGate from "@/components/PinGate";
import HoursAndAnnouncements from "@/components/HoursAndAnnouncements";
import { Plus, Trash2, Tag, Settings2, Sliders, X, Info, TrendingUp, Download } from "lucide-react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kickoff-ordina.vercel.app";

export default function AdminPage() {
  const [pin, setPin] = useState(null);
  if (!pin) return <PinGate label="Pannello Admin" role="admin" onUnlock={setPin} />;
  return <AdminDashboard pin={pin} />;
}

function AdminDashboard({ pin }) {
  const [tab, setTab] = useState("postazioni");
  const [zones, setZones] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [newTableZone, setNewTableZone] = useState("");
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category_id: "", station: "bar" });
  const [qrPreview, setQrPreview] = useState(null);
  const [optionsProduct, setOptionsProduct] = useState(null); // prodotto per cui gestisco varianti/aggiunte
  const [detailsProduct, setDetailsProduct] = useState(null); // prodotto per cui gestisco foto/tag/stock/orari

  async function loadAll() {
    const [{ data: z }, { data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("zones").select("*"),
      supabase.from("tables").select("*").is("archived_at", null),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("name"),
    ]);
    setZones(z || []);
    setTables(t || []);
    setCategories(c || []);
    setProducts(p || []);
    if (z?.length && !newTableZone) setNewTableZone(z[0].id);
    if (c?.length && !newProduct.category_id) setNewProduct((p) => ({ ...p, category_id: c[0].id }));
  }

  useEffect(() => { loadAll(); loadCustomers(); }, []);

  async function loadCustomers() {
    const res = await fetch(`/api/customers?pin=${encodeURIComponent(pin)}`);
    if (res.ok) {
      const { customers } = await res.json();
      setCustomers(customers || []);
    }
  }

  async function addTable() {
    if (!newTableLabel.trim()) return;
    await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, zone_id: newTableZone, label: newTableLabel.trim() }),
    });
    setNewTableLabel("");
    loadAll();
  }

  async function removeTable(id) {
    await fetch("/api/tables", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, id }),
    });
    loadAll();
  }

  async function addProduct() {
    if (!newProduct.name.trim() || !newProduct.price) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, name: newProduct.name.trim(), price: parseFloat(newProduct.price), category_id: newProduct.category_id, station: newProduct.station }),
    });
    setNewProduct((p) => ({ ...p, name: "", price: "" }));
    loadAll();
  }

  async function updateProductField(p, patch) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, pin }),
    });
    loadAll();
  }

  async function updateZoneSurcharge(zoneId, val) {
    await fetch(`/api/zones/${zoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surcharge: parseFloat(val) || 0, pin }),
    });
    loadAll();
  }

  const tabs = [
    { id: "postazioni", label: "Postazioni & QR" },
    { id: "prodotti", label: "Prodotti" },
    { id: "zone", label: "Zone & sovrapprezzi" },
    { id: "clienti", label: "Clienti" },
    { id: "orari", label: "Orari & Avvisi" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <img src="/logo-icon.png" alt="KickOff" className="h-9 w-auto" />
        <Settings2 className="h-5 w-5 text-stone-400" />
        <h1 className="text-2xl font-bold tracking-tight">Pannello Admin</h1>
      </div>

      <div className="flex gap-1 bg-stone-100 p-1 rounded-lg text-sm w-fit mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-md font-medium ${tab === t.id ? "bg-white shadow-sm" : "text-stone-500"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "postazioni" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-6 bg-white border border-stone-200 rounded-xl p-3">
            <select value={newTableZone} onChange={(e) => setNewTableZone(e.target.value)} className="text-sm border border-stone-300 rounded-md px-2 py-1.5">
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <input value={newTableLabel} onChange={(e) => setNewTableLabel(e.target.value)} placeholder="Es. Ombrellone 12" className="flex-1 min-w-[160px] text-sm border border-stone-300 rounded-md px-2 py-1.5" />
            <button onClick={addTable} className="flex items-center gap-1 text-sm font-semibold bg-stone-900 text-white px-3 py-1.5 rounded-md">
              <Plus className="h-3.5 w-3.5" /> Genera postazione + QR
            </button>
          </div>

          {zones.map((z) => {
            const zTables = tables.filter((t) => t.zone_id === z.id);
            return (
              <div key={z.id} className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider mb-2 text-stone-500">
                  {z.name} <span className="text-stone-300 font-normal normal-case">({zTables.length} postazioni)</span>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {zTables.map((t) => (
                    <TableCard key={t.id} table={t} onPreview={() => setQrPreview(t)} onRemove={() => removeTable(t.id)} />
                  ))}
                </div>
              </div>
            );
          })}

          {qrPreview && <QrModal table={qrPreview} onClose={() => setQrPreview(null)} />}
        </div>
      )}

      {tab === "prodotti" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-6 bg-white border border-stone-200 rounded-xl p-3">
            <input value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} placeholder="Nome prodotto" className="flex-1 min-w-[160px] text-sm border border-stone-300 rounded-md px-2 py-1.5" />
            <input value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} placeholder="Prezzo €" type="number" step="0.10" className="w-24 text-sm border border-stone-300 rounded-md px-2 py-1.5" />
            <select value={newProduct.category_id} onChange={(e) => setNewProduct((p) => ({ ...p, category_id: e.target.value }))} className="text-sm border border-stone-300 rounded-md px-2 py-1.5">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={newProduct.station} onChange={(e) => setNewProduct((p) => ({ ...p, station: e.target.value }))} className="text-sm border border-stone-300 rounded-md px-2 py-1.5">
              <option value="bar">🍹 Bar</option>
              <option value="cucina">🍳 Cucina</option>
            </select>
            <button onClick={addProduct} className="flex items-center gap-1 text-sm font-semibold bg-stone-900 text-white px-3 py-1.5 rounded-md">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </button>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-stone-400">{categories.find((c) => c.id === p.category_id)?.name}</div>
                </div>
                <select
                  value={p.station || "bar"}
                  onChange={(e) => updateProductField(p, { station: e.target.value })}
                  className="text-xs border border-stone-300 rounded-md px-2 py-1.5"
                >
                  <option value="bar">🍹 Bar</option>
                  <option value="cucina">🍳 Cucina</option>
                </select>
                <input
                  defaultValue={p.price}
                  type="number" step="0.10"
                  onBlur={(e) => updateProductField(p, { price: parseFloat(e.target.value) || 0 })}
                  className="w-20 text-sm border border-stone-300 rounded-md px-2 py-1 text-right"
                />
                <button onClick={() => updateProductField(p, { available: !p.available })} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${p.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                  {p.available ? "Attivo" : "Disattivato"}
                </button>
                {p.track_stock && (
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${(p.stock_qty ?? 0) <= p.low_stock_threshold ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}>
                    {p.stock_qty ?? 0} pz
                  </span>
                )}
                <button onClick={() => setDetailsProduct(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-stone-300 text-stone-600 flex items-center gap-1 shrink-0">
                  <Info className="h-3 w-3" /> Dettagli
                </button>
                <button onClick={() => setOptionsProduct(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-stone-300 text-stone-600 flex items-center gap-1 shrink-0">
                  <Sliders className="h-3 w-3" /> Varianti
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "zone" && (
        <div className="grid sm:grid-cols-3 gap-4">
          {zones.map((z) => (
            <div key={z.id} className="border border-stone-200 rounded-xl p-4 bg-white">
              <div className="text-sm font-bold mb-3">{z.name}</div>
              <label className="text-xs text-stone-400 font-medium">Sovrapprezzo consegna (€)</label>
              <div className="flex items-center gap-2 mt-1">
                <Tag className="h-3.5 w-3.5 text-stone-300" />
                <input
                  type="number" step="0.10" defaultValue={z.surcharge}
                  onBlur={(e) => updateZoneSurcharge(z.id, e.target.value)}
                  className="w-full text-sm border border-stone-300 rounded-md px-2 py-1.5"
                />
              </div>
              <div className="text-xs text-stone-400 mt-3">{tables.filter((t) => t.zone_id === z.id).length} postazioni attive</div>
            </div>
          ))}
        </div>
      )}

      {tab === "clienti" && (
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
          {customers.length === 0 && (
            <div className="text-sm text-stone-400 italic px-4 py-6 text-center">Nessun cliente registrato ancora.</div>
          )}
          {customers.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-stone-500">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                {c.marketing_consent && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Marketing OK</span>
                )}
                <div className="text-xs text-stone-400">
                  dal {new Date(c.created_at).toLocaleDateString("it-IT")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "orari" && <HoursAndAnnouncements pin={pin} />}
      {tab === "analytics" && <AnalyticsPanel pin={pin} />}

      {optionsProduct && (
        <ProductOptionsModal product={optionsProduct} pin={pin} onClose={() => setOptionsProduct(null)} />
      )}
      {detailsProduct && (
        <ProductDetailsModal product={detailsProduct} pin={pin} onClose={() => setDetailsProduct(null)} onSaved={loadAll} />
      )}
    </div>
  );
}

function ProductOptionsModal({ product, pin, onClose }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("single");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newOptionDraft, setNewOptionDraft] = useState({}); // { groupId: { name, price_delta } }

  async function loadGroups() {
    const { data: g } = await supabase
      .from("product_option_groups")
      .select("*, product_options(*)")
      .eq("product_id", product.id)
      .order("sort_order");
    setGroups((g || []).map((grp) => ({ ...grp, product_options: (grp.product_options || []).sort((a, b) => a.sort_order - b.sort_order) })));
  }

  useEffect(() => { loadGroups(); }, [product.id]);

  async function addGroup() {
    if (!newGroupName.trim()) return;
    await fetch("/api/product-options/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, product_id: product.id, name: newGroupName.trim(), selection_type: newGroupType, required: newGroupRequired }),
    });
    setNewGroupName("");
    setNewGroupRequired(false);
    loadGroups();
  }

  async function removeGroup(id) {
    await fetch(`/api/product-options/groups/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    loadGroups();
  }

  async function addOption(groupId) {
    const draft = newOptionDraft[groupId];
    if (!draft?.name?.trim()) return;
    await fetch("/api/product-options/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, group_id: groupId, name: draft.name.trim(), price_delta: draft.price_delta || 0 }),
    });
    setNewOptionDraft((prev) => ({ ...prev, [groupId]: { name: "", price_delta: "" } }));
    loadGroups();
  }

  async function removeOption(id) {
    await fetch(`/api/product-options/options/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    loadGroups();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Varianti e aggiunte</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-stone-400" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">{product.name}</p>

        {groups.map((g) => (
          <div key={g.id} className="border border-stone-200 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">{g.name}</div>
                <div className="text-[11px] text-stone-400">
                  {g.selection_type === "single" ? "Scelta singola" : "Scelta multipla"} · {g.required ? "obbligatorio" : "facoltativo"}
                </div>
              </div>
              <button onClick={() => removeGroup(g.id)} className="text-stone-300 hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 mb-2">
              {g.product_options.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm bg-stone-50 rounded-lg px-2.5 py-1.5">
                  <span>{o.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 tabular-nums">{o.price_delta > 0 ? `+€${Number(o.price_delta).toFixed(2)}` : "incluso"}</span>
                    <button onClick={() => removeOption(o.id)} className="text-stone-300 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {g.product_options.length === 0 && <div className="text-xs text-stone-300 italic px-1">Nessuna opzione ancora</div>}
            </div>

            <div className="flex gap-1.5">
              <input
                value={newOptionDraft[g.id]?.name || ""}
                onChange={(e) => setNewOptionDraft((prev) => ({ ...prev, [g.id]: { ...prev[g.id], name: e.target.value } }))}
                placeholder="Nome opzione"
                className="flex-1 text-xs border border-stone-300 rounded-md px-2 py-1.5"
              />
              <input
                value={newOptionDraft[g.id]?.price_delta || ""}
                onChange={(e) => setNewOptionDraft((prev) => ({ ...prev, [g.id]: { ...prev[g.id], price_delta: e.target.value } }))}
                placeholder="+€"
                type="number" step="0.10"
                className="w-16 text-xs border border-stone-300 rounded-md px-2 py-1.5"
              />
              <button onClick={() => addOption(g.id)} className="text-xs font-semibold bg-stone-900 text-white px-2.5 rounded-md">+</button>
            </div>
          </div>
        ))}

        <div className="border border-dashed border-stone-300 rounded-xl p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Nuovo gruppo</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder='Es. "Tipo" o "Aggiunte"'
              className="flex-1 min-w-[140px] text-sm border border-stone-300 rounded-md px-2 py-1.5"
            />
            <select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value)} className="text-sm border border-stone-300 rounded-md px-2 py-1.5">
              <option value="single">Scelta singola</option>
              <option value="multiple">Scelta multipla</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-stone-600 mb-2">
            <input type="checkbox" checked={newGroupRequired} onChange={(e) => setNewGroupRequired(e.target.checked)} />
            Obbligatorio (il cliente deve scegliere per poter ordinare)
          </label>
          <button onClick={addGroup} className="w-full text-sm font-semibold bg-stone-900 text-white py-2 rounded-lg">Aggiungi gruppo</button>
        </div>
      </div>
    </div>
  );
}

function TableCard({ table, onPreview, onRemove }) {
  const [dataUrl, setDataUrl] = useState(null);
  const url = `${SITE_URL}/o/${table.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 128, margin: 1 }).then(setDataUrl);
  }, [url]);

  return (
    <div className="border border-stone-200 rounded-xl p-3 bg-white">
      <div className="flex gap-3">
        <button onClick={onPreview}>
          {dataUrl ? <img src={dataUrl} alt="QR" className="h-16 w-16 rounded-sm" /> : <div className="h-16 w-16 bg-stone-100 rounded-sm" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{table.label}</div>
          <div className="text-[11px] text-stone-400 font-mono truncate">/o/{table.id.slice(0, 8)}…</div>
          <div className="flex gap-2 mt-1.5">
            <button onClick={onPreview} className="text-[11px] font-semibold text-stone-600">Vedi QR</button>
            <button onClick={onRemove} className="text-[11px] font-semibold text-rose-500">Elimina</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QrModal({ table, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const url = `${SITE_URL}/o/${table.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 400, margin: 2 }).then(setDataUrl);
  }, [url]);

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <img src="/logo-icon.png" alt="KickOff" className="h-8 w-auto mx-auto mb-3" />
        {dataUrl && <img src={dataUrl} alt="QR" className="mx-auto" width={220} height={220} />}
        <div className="mt-3 font-bold">{table.label}</div>
        <div className="text-xs text-stone-400 font-mono mb-4 break-all max-w-[220px]">{url}</div>
        <div className="text-xs text-stone-400 mb-4">Da stampare e plastificare, poi fissare alla postazione.</div>
        <a href={dataUrl} download={`qr-${table.label}.png`} className="text-sm font-semibold bg-stone-900 text-white px-4 py-2 rounded-lg inline-block">Scarica PNG</a>
      </div>
    </div>
  );
}

const TAG_OPTIONS = [
  { key: "tag_vegetarian", label: "🌱 Vegetariano" },
  { key: "tag_vegan", label: "🌿 Vegano" },
  { key: "tag_gluten_free", label: "🌾 Senza glutine" },
  { key: "tag_spicy", label: "🌶️ Piccante" },
  { key: "tag_recommended", label: "⭐ Consigliato" },
  { key: "tag_new", label: "🆕 Novità" },
  { key: "tag_bestseller", label: "🔥 Bestseller" },
];

function ProductDetailsModal({ product, pin, onClose, onSaved }) {
  const [form, setForm] = useState({
    description: product.description || "",
    image_url: product.image_url || "",
    visible_from: product.visible_from ? product.visible_from.slice(0, 5) : "",
    visible_until: product.visible_until ? product.visible_until.slice(0, 5) : "",
    track_stock: product.track_stock || false,
    stock_qty: product.stock_qty ?? "",
    low_stock_threshold: product.low_stock_threshold ?? 5,
    cost_price: product.cost_price ?? "",
    unavailable_note: product.unavailable_note || "",
    ...Object.fromEntries(TAG_OPTIONS.map((t) => [t.key, !!product[t.key]])),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, ...form }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Dettagli prodotto</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-stone-400" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">{product.name}</p>

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 block">Descrizione</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Es. Piadina con prosciutto crudo, stracchino e rucola"
          rows={2}
          className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 mb-3"
        />

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 block">URL immagine</label>
        <input
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          placeholder="https://…"
          className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 mb-3"
        />

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 block">Costo (facoltativo, per il margine)</label>
        <input
          value={form.cost_price}
          onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
          placeholder="Es. 0.70"
          type="number" step="0.10"
          className="w-28 text-sm border border-stone-300 rounded-lg px-3 py-2 mb-3"
        />

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 block">Tag</label>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {TAG_OPTIONS.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form[t.key]} onChange={(e) => setForm((f) => ({ ...f, [t.key]: e.target.checked }))} />
              {t.label}
            </label>
          ))}
        </div>

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 block">Visibile solo in fascia oraria (facoltativo)</label>
        <div className="flex items-center gap-2 mb-4">
          <input type="time" value={form.visible_from} onChange={(e) => setForm((f) => ({ ...f, visible_from: e.target.value }))} className="text-sm border border-stone-300 rounded-md px-2 py-1.5" />
          <span className="text-stone-300 text-xs">–</span>
          <input type="time" value={form.visible_until} onChange={(e) => setForm((f) => ({ ...f, visible_until: e.target.value }))} className="text-sm border border-stone-300 rounded-md px-2 py-1.5" />
          {(form.visible_from || form.visible_until) && (
            <button onClick={() => setForm((f) => ({ ...f, visible_from: "", visible_until: "" }))} className="text-xs text-stone-400">Rimuovi</button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm((f) => ({ ...f, track_stock: e.target.checked }))} />
          Gestisci magazzino per questo prodotto
        </label>
        {form.track_stock && (
          <div className="flex items-center gap-3 mb-4 pl-6">
            <div>
              <label className="text-[11px] text-stone-400 block">Quantità disponibile</label>
              <input type="number" value={form.stock_qty} onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))} className="w-20 text-sm border border-stone-300 rounded-md px-2 py-1" />
            </div>
            <div>
              <label className="text-[11px] text-stone-400 block">Avviso sotto</label>
              <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))} className="w-20 text-sm border border-stone-300 rounded-md px-2 py-1" />
            </div>
          </div>
        )}

        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1 block">
          Messaggio quando non disponibile (facoltativo)
        </label>
        <input
          value={form.unavailable_note}
          onChange={(e) => setForm((f) => ({ ...f, unavailable_note: e.target.value }))}
          placeholder="Es. Di nuovo disponibile dalle 16:00"
          className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 mb-4"
        />

        <button onClick={save} disabled={saving} className="w-full bg-stone-900 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
          {saving ? "Salvo…" : "Salva dettagli"}
        </button>
      </div>
    </div>
  );
}

function startOfRange(preset) {
  const now = new Date();
  const from = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "7d") { from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0); }
  if (preset === "30d") { from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0); }
  return from;
}

function fmtDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function AnalyticsPanel({ pin }) {
  const [preset, setPreset] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const from = startOfRange(preset).toISOString();
    const to = new Date().toISOString();
    const res = await fetch(`/api/analytics?pin=${encodeURIComponent(pin)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [preset]);

  function exportCsv() {
    if (!data) return;
    const rows = [["Prodotto", "Quantità", "Ricavi €", "Margine €"]];
    data.salesByProduct.forEach((p) => rows.push([p.name, p.qty, p.revenue.toFixed(2), p.margin != null ? p.margin.toFixed(2) : ""]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendite-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const presets = [
    { id: "today", label: "Oggi" },
    { id: "7d", label: "Ultimi 7 giorni" },
    { id: "30d", label: "Ultimo mese" },
  ];

  const maxHour = data ? Math.max(1, ...data.ordersByHour) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-lg text-sm w-fit">
          {presets.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)} className={`px-3 py-1.5 rounded-md font-medium ${preset === p.id ? "bg-white shadow-sm" : "text-stone-500"}`}>{p.label}</button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={!data} className="flex items-center gap-1.5 text-xs font-semibold border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> Esporta CSV
        </button>
      </div>

      {loading && <div className="text-sm text-stone-400 py-10 text-center">Calcolo le statistiche…</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Ordini" value={data.kpis.totalOrders} />
            <KpiCard label="Fatturato" value={`€${data.kpis.totalRevenue.toFixed(2)}`} />
            <KpiCard label="Scontrino medio" value={`€${data.kpis.avgTicket.toFixed(2)}`} />
            <KpiCard label="Tempo medio prep." value={fmtDuration(data.kpis.avgPrepSeconds)} />
            <KpiCard label="Ritiri" value={data.kpis.pickupCount} />
            <KpiCard label="Consegne" value={data.kpis.deliveryCount} />
            <KpiCard label="Rifiutati" value={data.kpis.rejectedCount} accent={data.kpis.rejectedCount > 0 ? "rose" : undefined} />
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Ordini per fascia oraria
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-end gap-1 h-32">
              {data.ordersByHour.map((count, h) => (
                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${count} ordini`}>
                  <div className="w-full bg-teal-600 rounded-t" style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? 2 : 0 }} />
                  {h % 3 === 0 && <div className="text-[9px] text-stone-400 mt-1">{h}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Vendite per zona</div>
              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {data.salesByZone.length === 0 && <div className="text-sm text-stone-400 italic px-4 py-4 text-center">Nessun dato</div>}
                {data.salesByZone.map((z) => (
                  <div key={z.zone_name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm">{z.zone_name}</span>
                    <span className="text-sm font-semibold tabular-nums">€{z.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Prodotti più venduti</div>
              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {data.salesByProduct.length === 0 && <div className="text-sm text-stone-400 italic px-4 py-4 text-center">Nessun dato</div>}
                {data.salesByProduct.slice(0, 8).map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs text-stone-400">{p.qty} pz{p.margin != null ? ` · margine €${p.margin.toFixed(2)}` : ""}</div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">€{p.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3">
      <div className={`text-xl font-bold tabular-nums ${accent === "rose" ? "text-rose-600" : "text-stone-900"}`}>{value}</div>
      <div className="text-xs text-stone-400 mt-0.5">{label}</div>
    </div>
  );
}

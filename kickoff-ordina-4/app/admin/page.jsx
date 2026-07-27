"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import PinGate from "@/components/PinGate";
import { Plus, Trash2, Tag, Settings2 } from "lucide-react";

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
  const [newTableZone, setNewTableZone] = useState("");
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category_id: "" });
  const [qrPreview, setQrPreview] = useState(null);

  async function loadAll() {
    const [{ data: z }, { data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("zones").select("*"),
      supabase.from("tables").select("*"),
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

  useEffect(() => { loadAll(); }, []);

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
      body: JSON.stringify({ pin, name: newProduct.name.trim(), price: parseFloat(newProduct.price), category_id: newProduct.category_id }),
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
                <input
                  defaultValue={p.price}
                  type="number" step="0.10"
                  onBlur={(e) => updateProductField(p, { price: parseFloat(e.target.value) || 0 })}
                  className="w-20 text-sm border border-stone-300 rounded-md px-2 py-1 text-right"
                />
                <button onClick={() => updateProductField(p, { available: !p.available })} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${p.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                  {p.available ? "Attivo" : "Disattivato"}
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

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Chiamato automaticamente da Vercel Cron (vedi vercel.json) una volta al
// giorno in serata. Vercel invia in automatico l'header
// "Authorization: Bearer $CRON_SECRET" quando CRON_SECRET è impostato
// tra le variabili d'ambiente del progetto — qui lo verifichiamo per
// essere sicuri che non lo chiami nessun altro.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", now.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const valid = (orders || []).filter((o) => o.status !== "rifiutato");
  const rejected = (orders || []).filter((o) => o.status === "rifiutato");
  const totalOrders = valid.length;
  const totalRevenue = valid.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const prepTimes = valid
    .filter((o) => o.accepted_at && o.completed_at)
    .map((o) => (new Date(o.completed_at) - new Date(o.accepted_at)) / 1000);
  const avgPrepMin = prepTimes.length > 0 ? prepTimes.reduce((s, t) => s + t, 0) / prepTimes.length / 60 : null;

  const productCounts = {};
  valid.forEach((o) => (o.order_items || []).forEach((it) => {
    productCounts[it.name] = (productCounts[it.name] || 0) + it.qty;
  }));
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

  const dateStr = now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1B2E2C;">
      <h2 style="color:#0E4A47;">KickOff Ordina — Report ${dateStr}</h2>
      <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding:6px 0; color:#666;">Ordini</td><td style="text-align:right; font-weight:bold;">${totalOrders}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Ricavi</td><td style="text-align:right; font-weight:bold;">€${totalRevenue.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Scontrino medio</td><td style="text-align:right; font-weight:bold;">€${avgTicket.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Tempo medio preparazione</td><td style="text-align:right; font-weight:bold;">${avgPrepMin != null ? avgPrepMin.toFixed(1) + " min" : "—"}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Prodotto più venduto</td><td style="text-align:right; font-weight:bold;">${topProduct ? `${topProduct[0]} (${topProduct[1]})` : "—"}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">Ordini rifiutati</td><td style="text-align:right; font-weight:bold;">${rejected.length}</td></tr>
      </table>
      <p style="color:#999; font-size:12px; margin-top:24px;">Report generato automaticamente da KickOff Ordina.</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY || !process.env.REPORT_EMAIL) {
    return NextResponse.json({ warning: "RESEND_API_KEY o REPORT_EMAIL non configurati, report non inviato", totalOrders, totalRevenue });
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REPORT_FROM_EMAIL || "KickOff Ordina <onboarding@resend.dev>",
      to: process.env.REPORT_EMAIL.split(",").map((e) => e.trim()),
      subject: `KickOff Ordina — Report ${dateStr}`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    return NextResponse.json({ error: `Invio email fallito: ${errText}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, totalOrders, totalRevenue });
}

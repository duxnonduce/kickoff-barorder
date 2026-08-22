import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Pubblica: mostra solo conteggi aggregati, nessun dato sensibile.
export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, order_items(product_id, qty)")
    .gte("created_at", since.toISOString())
    .neq("status", "rifiutato");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = {};
  (orders || []).forEach((o) => {
    (o.order_items || []).forEach((it) => {
      if (!it.product_id) return;
      counts[it.product_id] = (counts[it.product_id] || 0) + it.qty;
    });
  });

  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  return NextResponse.json({ productIds: topIds });
}

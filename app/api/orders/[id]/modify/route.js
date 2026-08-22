import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req, { params }) {
  const { id } = params;
  const { pin, removeItemIds } = await req.json();

  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!Array.isArray(removeItemIds) || removeItemIds.length === 0) {
    return NextResponse.json({ error: "Nessuna riga da rimuovere" }, { status: 400 });
  }

  const { error: delErr } = await supabaseAdmin
    .from("order_items")
    .delete()
    .in("id", removeItemIds)
    .eq("order_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { data: remaining, error: remErr } = await supabaseAdmin
    .from("order_items")
    .select("price, qty")
    .eq("order_id", id);
  if (remErr) return NextResponse.json({ error: remErr.message }, { status: 500 });

  if (!remaining || remaining.length === 0) {
    return NextResponse.json({ error: "Non puoi rimuovere tutte le righe: rifiuta l'ordine invece." }, { status: 400 });
  }

  const newTotal = remaining.reduce((s, it) => s + Number(it.price) * it.qty, 0);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ total: newTotal, status: "accettato", accepted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, order_items(*, order_item_options(*))")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

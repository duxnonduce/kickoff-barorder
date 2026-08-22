import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req, { params }) {
  const { id } = params;
  const { pin } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const { data: current, error: findErr } = await supabaseAdmin
    .from("orders")
    .select("reprint_count")
    .eq("id", id)
    .single();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

  // Il print-agent locale ascolta reprint_requested_at e stampa di nuovo,
  // poi lo azzera. Qui aggiorniamo anche il contatore per tracciabilità.
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ reprint_requested_at: new Date().toISOString(), reprint_count: (current?.reprint_count || 0) + 1 })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

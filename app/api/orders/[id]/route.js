import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const { id } = params;
  const body = await req.json();
  const { status, pin, reject_reason, priority } = body;

  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const patch = {};

  if (status !== undefined) {
    const allowed = ["accettato", "pronto", "completato", "rifiutato"];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    patch.status = status;
    if (status === "accettato") patch.accepted_at = new Date().toISOString();
    if (status === "completato") patch.completed_at = new Date().toISOString();
    if (status === "rifiutato" && reject_reason) patch.reject_reason = reject_reason;
  }

  if (priority !== undefined) {
    if (!["normal", "urgent"].includes(priority)) {
      return NextResponse.json({ error: "Priorità non valida" }, { status: 400 });
    }
    patch.priority = priority;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nessuna modifica indicata" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Alla accettazione: segna come da stampare. Il print-agent locale
  // (vedi /print-agent) ascolta questo evento via Supabase Realtime
  // e stampa lo scontrino sulla stampante di rete del bar.
  if (status === "accettato") {
    await supabaseAdmin.from("orders").update({ printed_at: null }).eq("id", id);
  }

  return NextResponse.json({ order: data });
}

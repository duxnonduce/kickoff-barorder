import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("service_status").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}

export async function PATCH(req) {
  const { pin, paused, pause_reason, paused_until, delivery_disabled } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const patch = { updated_at: new Date().toISOString() };
  if (paused !== undefined) patch.paused = paused;
  if (pause_reason !== undefined) patch.pause_reason = pause_reason || null;
  if (paused_until !== undefined) patch.paused_until = paused_until || null;
  if (delivery_disabled !== undefined) patch.delivery_disabled = delivery_disabled;

  const { data, error } = await supabaseAdmin
    .from("service_status")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}

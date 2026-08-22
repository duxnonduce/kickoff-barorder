import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, staff_name, action, details } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!action) return NextResponse.json({ error: "Azione obbligatoria" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("activity_log")
    .insert({ staff_name: staff_name || null, action, details: details || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

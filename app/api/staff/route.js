import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

// Elenco pubblico: serve al selettore "Chi sei?" su /bar e /admin.
// Nessun dato sensibile (solo nomi), quindi niente PIN richiesto qui.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

export async function POST(req) {
  const { pin, name, role } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("staff")
    .insert({ name: name.trim(), role: role || "entrambi" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

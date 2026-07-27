import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

// Lettura pubblica: usata dalla pagina cliente per mostrare gli avvisi attivi.
export async function GET() {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data });
}

// Creazione: bar e admin possono entrambi pubblicare un avviso.
export async function POST(req) {
  const { pin, message } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "Messaggio obbligatorio" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert({ message: message.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

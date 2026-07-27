import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

// Lettura pubblica: usata dalla pagina cliente per sapere fino a che ora ordinare.
export async function GET() {
  const { data, error } = await supabase.from("opening_hours").select("*").order("day_of_week");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hours: data });
}

// Modifica: bar e admin possono entrambi aggiornare gli orari.
export async function PATCH(req) {
  const { pin, day_of_week, open_time, close_time, closed } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("opening_hours")
    .update({ open_time, close_time, closed })
    .eq("day_of_week", day_of_week)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hour: data });
}

import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const { id } = params;
  const { pin, active } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .update({ active })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function DELETE(req, { params }) {
  const { id } = params;
  const { pin } = await req.json();
  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

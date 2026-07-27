import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const { id } = params;
  const body = await req.json();
  const { pin, ...fields } = body;

  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const allowedFields = ["available", "price", "name", "prep_min", "category_id"];
  const patch = {};
  for (const k of allowedFields) if (k in fields) patch[k] = fields[k];

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

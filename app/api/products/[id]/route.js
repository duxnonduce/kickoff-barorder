import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const { id } = params;
  const body = await req.json();
  const { pin, ...fields } = body;

  if (!checkPin(pin, "bar")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const allowedFields = [
    "available", "price", "name", "prep_min", "category_id", "station",
    "description", "image_url",
    "tag_vegetarian", "tag_vegan", "tag_gluten_free", "tag_spicy",
    "tag_recommended", "tag_new", "tag_bestseller",
    "visible_from", "visible_until",
    "track_stock", "stock_qty", "low_stock_threshold", "unavailable_note",
  ];
  const patch = {};
  for (const k of allowedFields) if (k in fields) patch[k] = fields[k];
  // stringhe vuote per orari/stock devono diventare null, non stringa vuota
  if (patch.visible_from === "") patch.visible_from = null;
  if (patch.visible_until === "") patch.visible_until = null;
  if (patch.stock_qty === "") patch.stock_qty = null;

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

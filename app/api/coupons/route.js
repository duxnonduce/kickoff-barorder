import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function GET(req) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data });
}

export async function POST(req) {
  const { pin, code, discount_type, discount_value, valid_from, valid_until, max_uses, min_order_total } = await req.json();
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!code?.trim() || !discount_value) {
    return NextResponse.json({ error: "Codice e valore sconto obbligatori" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("coupons")
    .insert({
      code: code.trim().toUpperCase(),
      discount_type: discount_type === "fixed" ? "fixed" : "percent",
      discount_value: parseFloat(discount_value),
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      max_uses: max_uses || null,
      min_order_total: min_order_total || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}

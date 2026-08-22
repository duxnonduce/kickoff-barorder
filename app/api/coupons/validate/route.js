import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { code, subtotal } = await req.json();
  if (!code?.trim()) {
    return NextResponse.json({ valid: false, message: "Inserisci un codice" }, { status: 400 });
  }

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!coupon) return NextResponse.json({ valid: false, message: "Codice non valido" });
  if (!coupon.active) return NextResponse.json({ valid: false, message: "Codice non più attivo" });

  const now = new Date();
  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    return NextResponse.json({ valid: false, message: "Codice non ancora valido" });
  }
  if (coupon.valid_until && now > new Date(coupon.valid_until)) {
    return NextResponse.json({ valid: false, message: "Codice scaduto" });
  }
  if (coupon.max_uses != null && coupon.times_used >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: "Codice esaurito" });
  }
  if (coupon.min_order_total != null && Number(subtotal || 0) < Number(coupon.min_order_total)) {
    return NextResponse.json({ valid: false, message: `Valido da un ordine minimo di €${Number(coupon.min_order_total).toFixed(2)}` });
  }

  const discount = coupon.discount_type === "percent"
    ? Number(subtotal || 0) * (Number(coupon.discount_value) / 100)
    : Math.min(Number(coupon.discount_value), Number(subtotal || 0));

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discount_amount: Math.round(discount * 100) / 100,
    message: coupon.discount_type === "percent" ? `${coupon.discount_value}% di sconto applicato` : `€${Number(coupon.discount_value).toFixed(2)} di sconto applicato`,
  });
}

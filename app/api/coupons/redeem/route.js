import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ ok: false });

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("id, times_used")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!coupon) return NextResponse.json({ ok: false });

  await supabaseAdmin
    .from("coupons")
    .update({ times_used: coupon.times_used + 1 })
    .eq("id", coupon.id);

  return NextResponse.json({ ok: true });
}

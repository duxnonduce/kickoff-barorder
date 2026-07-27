import { NextResponse } from "next/server";
import { checkStaffPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin } = await req.json();
  return NextResponse.json({ ok: checkStaffPin(pin) });
}

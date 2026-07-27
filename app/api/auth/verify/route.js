import { NextResponse } from "next/server";
import { checkPin } from "@/lib/supabaseAdmin";

export async function POST(req) {
  const { pin, role } = await req.json();
  return NextResponse.json({ ok: checkPin(pin, role || "bar") });
}

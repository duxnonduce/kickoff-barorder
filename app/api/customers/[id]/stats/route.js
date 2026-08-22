import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

export async function GET(req, { params }) {
  const { id } = params;
  const pin = req.nextUrl.searchParams.get("pin");
  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const valid = (orders || []).filter((o) => o.status !== "rifiutato");
  const orderCount = valid.length;
  const totalSpent = valid.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = orderCount > 0 ? totalSpent / orderCount : 0;
  const lastOrderAt = valid[0]?.created_at || null;

  const productCounts = {};
  valid.forEach((o) => {
    (o.order_items || []).forEach((it) => {
      productCounts[it.name] = (productCounts[it.name] || 0) + it.qty;
    });
  });
  const favoriteProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const ratings = valid.filter((o) => o.rating != null).map((o) => o.rating);
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

  return NextResponse.json({
    stats: { orderCount, totalSpent, avgTicket, lastOrderAt, favoriteProduct, avgRating },
    recentOrders: valid.slice(0, 10).map((o) => ({ code: o.code, total: o.total, created_at: o.created_at, status: o.status })),
  });
}

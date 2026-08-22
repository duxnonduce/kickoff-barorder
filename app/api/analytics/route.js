import { NextResponse } from "next/server";
import { supabaseAdmin, checkPin } from "@/lib/supabaseAdmin";

// Statistiche vendite, solo admin. Prende un intervallo [from, to] in ISO.
export async function GET(req) {
  const { searchParams } = req.nextUrl;
  const pin = searchParams.get("pin");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!checkPin(pin, "admin")) {
    return NextResponse.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (!from || !to) {
    return NextResponse.json({ error: "Intervallo date obbligatorio" }, { status: 400 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*), zones:zone_id(name), tables:table_id(label)")
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: products } = await supabaseAdmin.from("products").select("id, name, cost_price");
  const costByProductId = Object.fromEntries((products || []).map((p) => [p.id, p.cost_price]));

  const valid = (orders || []).filter((o) => o.status !== "rifiutato");
  const rejected = (orders || []).filter((o) => o.status === "rifiutato");

  const totalOrders = valid.length;
  const totalRevenue = valid.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const pickupCount = valid.filter((o) => o.type === "ritiro").length;
  const deliveryCount = valid.filter((o) => o.type === "consegna").length;

  const prepTimes = valid
    .filter((o) => o.accepted_at && o.completed_at)
    .map((o) => (new Date(o.completed_at) - new Date(o.accepted_at)) / 1000);
  const avgPrepSeconds = prepTimes.length > 0 ? prepTimes.reduce((s, t) => s + t, 0) / prepTimes.length : null;

  const ordersByHour = new Array(24).fill(0);
  valid.forEach((o) => {
    const h = new Date(o.created_at).getHours();
    ordersByHour[h] += 1;
  });

  const zoneMap = {};
  valid.forEach((o) => {
    const key = o.zone_id || "n/a";
    const name = o.zones?.name || "—";
    if (!zoneMap[key]) zoneMap[key] = { zone_name: name, total: 0, count: 0 };
    zoneMap[key].total += Number(o.total);
    zoneMap[key].count += 1;
  });
  const salesByZone = Object.values(zoneMap).sort((a, b) => b.total - a.total);

  const productMap = {};
  valid.forEach((o) => {
    (o.order_items || []).forEach((it) => {
      const key = it.product_id || it.name;
      if (!productMap[key]) productMap[key] = { name: it.name, qty: 0, revenue: 0, cost: 0, hasCost: costByProductId[it.product_id] != null };
      productMap[key].qty += it.qty;
      productMap[key].revenue += Number(it.price) * it.qty;
      if (costByProductId[it.product_id] != null) {
        productMap[key].cost += Number(costByProductId[it.product_id]) * it.qty;
      }
    });
  });
  const salesByProduct = Object.values(productMap)
    .map((p) => ({ ...p, margin: p.hasCost ? p.revenue - p.cost : null }))
    .sort((a, b) => b.revenue - a.revenue);

  const ratedOrders = valid.filter((o) => o.rating != null);
  const avgRating = ratedOrders.length > 0 ? ratedOrders.reduce((s, o) => s + o.rating, 0) / ratedOrders.length : null;
  const lowRatings = ratedOrders.filter((o) => o.rating <= 2).map((o) => ({ code: o.code, rating: o.rating, comment: o.rating_comment }));

  const ordersExport = (orders || []).map((o) => ({
    code: o.code,
    created_at: o.created_at,
    status: o.status,
    type: o.type,
    table_label: o.tables?.label || null,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    total: o.total,
    discount_amount: o.discount_amount,
    coupon_code: o.coupon_code,
    rating: o.rating,
  }));

  return NextResponse.json({
    kpis: {
      totalOrders,
      totalRevenue,
      avgTicket,
      pickupCount,
      deliveryCount,
      rejectedCount: rejected.length,
      avgPrepSeconds,
      avgRating,
      ratedCount: ratedOrders.length,
    },
    ordersByHour,
    salesByZone,
    salesByProduct,
    lowRatings,
    orders: ordersExport,
  });
}

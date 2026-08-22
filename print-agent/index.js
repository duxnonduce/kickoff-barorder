// print-agent
//
// Questo script gira su un piccolo PC/Raspberry Pi collegato alla stessa
// rete della stampante termica del bar (Vercel non può raggiungere una
// stampante in LAN, quindi serve un agent locale).
//
// Cosa fa:
// 1. Si mette in ascolto sugli ordini di Supabase (Realtime).
// 2. Quando un ordine passa a status = "accettato", scarica le righe
//    ordine, le divide per postazione (bar/cucina) e stampa una comanda
//    per ciascuna postazione coinvolta, via ESC/POS sulla stampante di rete.
// 3. Segna l'ordine come "printed_at" per evitare doppie stampe.
//
// Setup:
//   cd print-agent
//   npm install
//   cp .env.example .env
//   # compila SUPABASE_URL, SERVICE_ROLE_KEY, PRINTER_IP_BAR
//   # PRINTER_IP_CUCINA è facoltativo: se non lo imposti, la comanda
//   # cucina esce dalla stessa stampante del bar (due scontrini separati)
//   node index.js
//
// Consiglio: avvialo con pm2 o come servizio systemd così riparte da solo
// se il Pi si riavvia.

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function makePrinter(ip) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON, // cambia in STAR se la tua stampante è Star
    interface: `tcp://${ip}`,
    width: 42,
  });
}

const barPrinterIp = process.env.PRINTER_IP_BAR || process.env.PRINTER_IP;
const kitchenPrinterIp = process.env.PRINTER_IP_CUCINA || barPrinterIp;

async function printTicket({ printer, title, order, table, items, showPrices }) {
  printer.alignCenter();
  printer.bold(true);
  printer.println(title);
  printer.bold(false);
  printer.println(`Ordine ${order.code}`);
  printer.drawLine();
  printer.alignLeft();
  printer.println(table?.label || "");
  printer.println(order.type === "ritiro" ? "RITIRO AL BANCO" : "CONSEGNA IN ZONA");
  printer.println(order.requested_time ? `Ore ${new Date(order.requested_time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : "Il prima possibile");
  if (showPrices && order.customer_name) printer.println(`${order.customer_name} - ${order.customer_phone}`);
  printer.drawLine();
  for (const it of items) {
    if (showPrices) {
      printer.leftRight(`${it.qty}x ${it.name}`, `EUR ${(it.price * it.qty).toFixed(2)}`);
    } else {
      printer.println(`${it.qty}x ${it.name}`);
    }
    if (it.order_item_options?.length > 0) {
      printer.println(`  ${it.order_item_options.map((o) => o.option_name).join(", ")}`);
    }
    if (it.note) printer.println(`  -> ${it.note}`);
  }
  if (showPrices) {
    printer.drawLine();
    printer.bold(true);
    printer.leftRight("TOTALE", `EUR ${Number(order.total).toFixed(2)}`);
    printer.bold(false);
  }
  if (order.note) {
    printer.newLine();
    printer.println(`Nota: ${order.note}`);
  }
  if (showPrices) {
    printer.newLine();
    printer.alignCenter();
    printer.println(`Pagamento al ${order.type === "ritiro" ? "ritiro" : "momento della consegna"}`);
  }
  printer.cut();
  await printer.execute();
}

async function printOrder(order) {
  const { data: items } = await supabase
    .from("order_items")
    .select("*, order_item_options(*)")
    .eq("order_id", order.id);

  const { data: table } = await supabase
    .from("tables")
    .select("label")
    .eq("id", order.table_id)
    .single();

  const all = items || [];
  const barItems = all.filter((it) => (it.station || "bar") === "bar");
  const kitchenItems = all.filter((it) => it.station === "cucina");

  try {
    if (barItems.length > 0) {
      const printer = makePrinter(barPrinterIp);
      await printTicket({ printer, title: "KICKOFF - BAR", order, table, items: barItems, showPrices: true });
    }
    if (kitchenItems.length > 0) {
      const printer = makePrinter(kitchenPrinterIp);
      await printTicket({ printer, title: "COMANDA CUCINA", order, table, items: kitchenItems, showPrices: false });
    }
    console.log(`Stampato ordine ${order.code} (bar: ${barItems.length}, cucina: ${kitchenItems.length})`);

    await supabase.from("orders").update({ printed_at: new Date().toISOString() }).eq("id", order.id);
  } catch (err) {
    console.error(`Errore stampa ordine ${order.code}:`, err.message);
  }
}

console.log("print-agent avviato, in ascolto sugli ordini accettati...");
console.log(`Stampante bar: ${barPrinterIp} · Stampante cucina: ${kitchenPrinterIp}${kitchenPrinterIp === barPrinterIp ? " (stessa stampante)" : ""}`);

supabase
  .channel("print-agent")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "orders" },
    (payload) => {
      const order = payload.new;
      if (order.status === "accettato" && !order.printed_at) {
        printOrder(order);
      } else if (order.reprint_requested_at) {
        // Ristampa richiesta manualmente dal bar: stampa di nuovo e azzera
        // il flag, senza toccare printed_at (che resta la prima stampa).
        printOrder(order).then(() =>
          supabase.from("orders").update({ reprint_requested_at: null }).eq("id", order.id)
        );
      }
    }
  )
  .subscribe();

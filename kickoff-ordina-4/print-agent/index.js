// print-agent
//
// Questo script gira su un piccolo PC/Raspberry Pi collegato alla stessa
// rete della stampante termica del bar (Vercel non può raggiungere una
// stampante in LAN, quindi serve un agent locale).
//
// Cosa fa:
// 1. Si mette in ascolto sugli ordini di Supabase (Realtime).
// 2. Quando un ordine passa a status = "accettato", scarica le righe
//    ordine e stampa lo scontrino via ESC/POS sulla stampante di rete.
// 3. Segna l'ordine come "printed_at" per evitare doppie stampe.
//
// Setup:
//   cd print-agent
//   npm install
//   cp .env.example .env      # compila SUPABASE_URL, SERVICE_ROLE_KEY, PRINTER_IP
//   node index.js
//
// Consiglio: avvialo con pm2 o come servizio systemd così riparte da solo
// se il Pi si riavvia.

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON, // cambia in STAR se la tua stampante è Star
  interface: `tcp://${process.env.PRINTER_IP}`,
  width: 42,
});

async function printOrder(order) {
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const { data: table } = await supabase
    .from("tables")
    .select("label")
    .eq("id", order.table_id)
    .single();

  try {
    printer.alignCenter();
    printer.bold(true);
    printer.println("KICKOFF - BAR");
    printer.bold(false);
    printer.println(`Ordine ${order.code}`);
    printer.drawLine();
    printer.alignLeft();
    printer.println(table?.label || "");
    printer.println(order.type === "ritiro" ? "RITIRO AL BANCO" : "CONSEGNA IN ZONA");
    printer.drawLine();
    for (const it of items || []) {
      printer.leftRight(`${it.qty}x ${it.name}`, `EUR ${(it.price * it.qty).toFixed(2)}`);
    }
    printer.drawLine();
    printer.bold(true);
    printer.leftRight("TOTALE", `EUR ${Number(order.total).toFixed(2)}`);
    printer.bold(false);
    if (order.note) {
      printer.newLine();
      printer.println(`Nota: ${order.note}`);
    }
    printer.newLine();
    printer.alignCenter();
    printer.println(`Pagamento al ${order.type === "ritiro" ? "ritiro" : "momento della consegna"}`);
    printer.cut();
    await printer.execute();
    console.log(`Stampato ordine ${order.code}`);

    await supabase.from("orders").update({ printed_at: new Date().toISOString() }).eq("id", order.id);
  } catch (err) {
    console.error(`Errore stampa ordine ${order.code}:`, err.message);
  }
}

console.log("print-agent avviato, in ascolto sugli ordini accettati...");

supabase
  .channel("print-agent")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "orders" },
    (payload) => {
      const order = payload.new;
      if (order.status === "accettato" && !order.printed_at) {
        printOrder(order);
      }
    }
  )
  .subscribe();

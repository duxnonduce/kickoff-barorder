import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

// Invia una notifica push a tutti i dispositivi iscritti a un ordine
// (di solito uno solo: il telefono del cliente che lo sta seguendo).
// Se le chiavi VAPID non sono configurate, non fa nulla — il resto del
// sito continua a funzionare normalmente (il cliente vede comunque
// l'aggiornamento in tempo reale nella pagina, se è aperta).
export async function sendPushToOrder(orderId, { title, body }) {
  if (!ensureConfigured()) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("order_id", orderId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      } catch (err) {
        // 404/410 = l'iscrizione non è più valida (permesso revocato, browser disinstallato...)
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

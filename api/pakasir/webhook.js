/**
 * Vercel Serverless Function — Pakasir webhook
 * POST /api/pakasir/webhook
 */
"use strict";

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`;
const JSONBIN_WRITE_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;

async function getDB() {
  const r = await fetch(JSONBIN_URL, {
    headers: { "X-Access-Key": process.env.JSONBIN_ACCESS_KEY }
  });
  if (!r.ok) throw new Error(`JSONBin read ${r.status}`);
  return (await r.json()).record || {};
}

async function putDB(db) {
  const r = await fetch(JSONBIN_WRITE_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": process.env.JSONBIN_MASTER_KEY
    },
    body: JSON.stringify(db)
  });
  if (!r.ok) throw new Error(`JSONBin write ${r.status}: ${await r.text()}`);
}

async function verifyWithPakasir(orderId, amount) {
  const u = new URL("https://app.pakasir.com/api/transactiondetail");
  u.searchParams.set("project", process.env.PAKASIR_PROJECT);
  u.searchParams.set("amount", String(amount));
  u.searchParams.set("order_id", orderId);
  u.searchParams.set("api_key", process.env.PAKASIR_API_KEY);

  const r = await fetch(u);
  if (!r.ok) throw new Error(`Pakasir verify ${r.status}`);
  return (await r.json()).transaction || null;
}

async function sendTelegramNotification(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram belum dikonfigurasi: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");

  const text = [
    "💰 *PEMBAYARAN BERHASIL*",
    "",
    `🧾 Order: \`${order.id}\``,
    `📦 Produk: ${order.product}`,
    `💵 Nominal: *Rp ${Number(order.price).toLocaleString("id-ID")}*`,
    `👤 Pembeli: ${order.name}`,
    `📱 WhatsApp: ${order.whatsapp}`,
    `📧 Email: ${order.email}`,
    `💳 Metode: ${(order.paymentMethod || "QRIS").toUpperCase()}`,
    `🕐 Dibayar: ${order.paidAt}`,
    "",
    "✅ Status: *PAID*"
  ].join("\\n");

  const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(`Telegram sendMessage gagal: ${data.description || r.status}`);
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const payload = req.body || {};
    const { amount, order_id, project, status, payment_method, completed_at } = payload;

    if (!order_id || !amount || project !== process.env.PAKASIR_PROJECT) {
      return res.status(400).json({ error: "Webhook tidak valid." });
    }

    const db = await getDB();
    db.orders = Array.isArray(db.orders) ? db.orders : [];
    const order = db.orders.find(o => String(o.id) === String(order_id));

    if (!order) return res.status(404).json({ error: "Order tidak ditemukan." });

    // Idempotent: webhook bisa dikirim lebih dari sekali.
    // Jika order sudah paid tetapi notifikasi Telegram gagal sebelumnya,
    // webhook berikutnya boleh mencoba mengirim notifikasi lagi.
    if (["paid", "completed"].includes(order.status) && order.telegramNotifiedAt) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    if (Number(order.price) !== Number(amount)) {
      return res.status(400).json({ error: "Nominal webhook tidak cocok." });
    }

    // Jangan percaya status webhook mentah; cek lagi ke API Pakasir.
    const verified = await verifyWithPakasir(order_id, amount);
    if (!verified || verified.status !== "completed" || Number(verified.amount) !== Number(order.price)) {
      return res.status(400).json({ error: "Pembayaran belum terverifikasi." });
    }

    order.status = "paid";
    order.paymentProvider = "pakasir";
    order.paymentMethod = payment_method || verified.payment_method || "qris";
    order.paidAt = completed_at || verified.completed_at || new Date().toISOString();
    order.verifiedAt = new Date().toISOString();

    // Simpan status paid terlebih dahulu.
    await putDB(db);

    // Kirim notifikasi ke Telegram setelah pembayaran terverifikasi.
    // Jika Telegram gagal, webhook mengembalikan 500 agar Pakasir dapat retry.
    try {
      await sendTelegramNotification(order);
      order.telegramNotifiedAt = new Date().toISOString();
      await putDB(db);
    } catch (telegramError) {
      console.error(telegramError);
      return res.status(500).json({
        error: "Pembayaran sudah PAID, tetapi notifikasi Telegram gagal.",
        order_id
      });
    }

    return res.status(200).json({ ok: true, order_id, telegram_notified: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Webhook error." });
  }
};

/**
 * Vercel Serverless Function — Verify/display Pakasir transaction
 * GET /api/pakasir/status?order_id=...&amount=...
 */
"use strict";

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { order_id, amount } = req.query || {};
  if (!order_id || !amount) return res.status(400).json({ error: "order_id dan amount wajib." });

  try {
    const u = new URL("https://app.pakasir.com/api/transactiondetail");
    u.searchParams.set("project", process.env.PAKASIR_PROJECT);
    u.searchParams.set("amount", String(amount));
    u.searchParams.set("order_id", String(order_id));
    u.searchParams.set("api_key", process.env.PAKASIR_API_KEY);

    const r = await fetch(u);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Gagal mengecek status pembayaran." });
  }
};

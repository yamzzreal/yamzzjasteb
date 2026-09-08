/**
 * Vercel Serverless Function — Create Pakasir payment
 * POST /api/pakasir/create
 */
"use strict";

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`;
const JSONBIN_WRITE_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

function json(res, status, body) {
  res.status(status).json(body);
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const { productId, name, whatsapp, email, note } = req.body || {};
    if (!productId || !name || !whatsapp || !email) {
      return json(res, 400, { error: "Data checkout belum lengkap." });
    }

    const db = await getDB();
    const products = Array.isArray(db.products) ? db.products : [];
    const product = products.find(p => String(p.id) === String(productId));

    if (!product || product.active === false) {
      return json(res, 404, { error: "Produk tidak ditemukan atau sedang nonaktif." });
    }

    const price = Number(product.price);
    const stock = Number(product.stock ?? 1);
    if (!Number.isFinite(price) || price <= 0) {
      return json(res, 400, { error: "Harga produk tidak valid." });
    }
    if (stock <= 0) {
      return json(res, 409, { error: "Stok produk sedang habis." });
    }

    const orderId = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const order = {
      id: orderId,
      productId: product.id,
      product: product.name || "Produk",
      category: product.category || "Jasteb",
      ress: Number(product.ress || 0),
      price,
      name: String(name).trim().slice(0, 80),
      whatsapp: String(whatsapp).trim().slice(0, 20),
      email: String(email).trim().slice(0, 120),
      note: String(note || "").trim().slice(0, 300),
      status: "pending",
      paymentProvider: "pakasir",
      paymentMethod: null,
      createdAt: new Date().toISOString()
    };

    db.orders = Array.isArray(db.orders) ? db.orders : [];
    db.orders.unshift(order);
    db.orders = db.orders.slice(0, 1000);
    await putDB(db);

    const slug = process.env.PAKASIR_PROJECT;
    const redirect = process.env.PAKASIR_REDIRECT_URL ||
      `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/payment.html?order_id=${encodeURIComponent(orderId)}`;

    if (!slug) throw new Error("PAKASIR_PROJECT belum dikonfigurasi.");

    const paymentUrl =
      `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${price}` +
      `?order_id=${encodeURIComponent(orderId)}` +
      `&redirect=${encodeURIComponent(redirect)}` +
      `&qris_only=1`;

    return json(res, 200, {
      success: true,
      order_id: orderId,
      amount: price,
      payment_url: paymentUrl
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || "Gagal membuat pembayaran." });
  }
};

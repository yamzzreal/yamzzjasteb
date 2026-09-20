const crypto = require('crypto');
const { jsonbin, save } = require('./_common');

function validSignature(raw, sig, secret) {
  if (!sig || !secret || !raw) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(String(sig), 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' })
  }).catch(err => console.error('Telegram error:', err.message));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Vercel bodyParser dimatikan lewat config di bawah agar signature memakai RAW BODY.
    const rawBuffer = await readRawBody(req);
    const raw = rawBuffer.toString('utf8');
    const sig = req.headers['x-casaku-signature'];

    if (!validSignature(rawBuffer, sig, process.env.CASAKU_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(raw);
    if (payload.status !== 'paid') return res.status(200).json({ ok: true });
    if (!payload.transactionId) return res.status(400).json({ error: 'transactionId missing' });

    const db = await jsonbin();
    db.orders = Array.isArray(db.orders) ? db.orders : [];
    const order = db.orders.find(x => x.casakuTransactionId === payload.transactionId);

    // Selalu balas 2xx untuk payload yang sah agar Casaku tidak retry tanpa perlu.
    if (!order) return res.status(200).json({ ok: true, unmatched: true });

    const wasPaid = order.status === 'paid';

    // Backfill link produk untuk order lama yang belum memilikinya.
    const productForDelivery = (Array.isArray(db.products) ? db.products : []).find(
      p => String(p.id) === String(order.productId)
    );
    if (!String(order.deliveryLink || '').trim() && productForDelivery) {
      order.deliveryLink = String(
        productForDelivery.deliveryLink ||
        productForDelivery.productLink ||
        productForDelivery.link ||
        ''
      ).trim();
    }

    // Kurangi stok tepat satu kali saat transaksi menjadi PAID.
    if (!wasPaid && order.stockDeducted !== true) {
      const product = (Array.isArray(db.products) ? db.products : []).find(
        p => String(p.id) === String(order.productId)
      );
      if (product) {
        const current = Number(product.stock ?? product.stok ?? product.quantity ?? 0);
        const next = Math.max(0, current - Number(order.quantity || 1));
        product.stock = next;
        if ('stok' in product) product.stok = next;
        if ('quantity' in product) product.quantity = next;
        order.stockDeducted = true;
      }
    }

    order.status = 'paid';
    order.paidAt = payload.paidAt || new Date().toISOString();
    order.gatewayAmount = Number(payload.amount) || order.price;
    await save(db);

    if (!wasPaid) {
      await telegram(
        `💰 <b>PEMBAYARAN MASUK</b>\n\n` +
        `🧾 ${order.id}\n` +
        `📦 ${order.product}\n` +
        `💵 Rp${Number(order.price).toLocaleString('id-ID')}\n` +
        `👤 ${order.name}\n` +
        `📱 https://wa.me/${order.whatsapp}\n` +
        `💌 ${order.email}\n\n` +
        `✅ <b>PAID</b> via Casaku`
      );
    }

    return res.status(200).json({ ok: true, paid: true, orderId: order.id });
  } catch (e) {
    console.error('Casaku webhook error:', e);
    return res.status(500).json({ error: e.message || 'Webhook error' });
  }
};

// Penting: Casaku menandatangani RAW JSON body, bukan hasil JSON.parse().
module.exports.config = {
  api: { bodyParser: false }
};

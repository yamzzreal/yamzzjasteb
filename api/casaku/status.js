const { CASAKU_API, LICENSE_KEY, jsonbin, save } = require('./_common');
const { privateDb, savePrivateDb, addNotification } = require('../auth/_common');

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });

  return response.ok;
}

async function markPaidAndNotify(transactionId, gatewayAmount, paidAt) {
  const db = await jsonbin();
  db.orders = Array.isArray(db.orders) ? db.orders : [];

  const order = db.orders.find(
    item => String(item.casakuTransactionId) === String(transactionId)
  );

  if (!order) return null;

  const wasPaid = order.status === 'paid';

  // Pastikan order lama juga mendapat link terbaru dari produk jika sebelumnya kosong.
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
  order.paidAt = order.paidAt || paidAt || new Date().toISOString();
  order.gatewayAmount = Number(gatewayAmount) || Number(order.price) || 0;

  // Simpan dulu status paid supaya refresh/poll berikutnya tidak mengirim ulang.
  if (!wasPaid && !order.telegramNotifiedAt) {
    const sent = await sendTelegram(
      `💰 <b>PEMBAYARAN MASUK</b>\n\n` +
      `🧾 ${order.id}\n` +
      `📦 ${order.product}\n` +
      `💵 Rp${Number(order.price).toLocaleString('id-ID')}\n` +
      `👤 ${order.name}\n` +
      `📱 ${order.whatsapp}\n\n` +
      `✅ <b>PAID</b> via Casaku`
    );

    if (sent) order.telegramNotifiedAt = new Date().toISOString();
  }

  await save(db);
  if (!wasPaid && order.userId) {
    try {
      const pdb = await privateDb();
      addNotification(
        pdb,
        order.userId,
        'Pembayaran berhasil',
        `Transaksi ${order.id} untuk ${order.product} sudah PAID.`,
        'success'
      );
      await savePrivateDb(pdb);
    } catch (notifyError) {
      console.error('USER NOTIFICATION ERROR', notifyError);
    }
  }
  return order;
}

async function updatePendingOrder(transactionId, status) {
  const db = await jsonbin();
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  const order = db.orders.find(
    item => String(item.casakuTransactionId) === String(transactionId)
  );

  if (!order) return null;

  if (order.status !== 'paid') {
    if (status === 'expired' || status === 'cancel') {
      order.status = 'rejected';
    } else if (status === 'pending') {
      order.status = 'pending';
    }
  }

  await save(db);
  return order;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!LICENSE_KEY) {
      return res.status(500).json({ error: 'CASAKU_LICENSE_KEY belum diatur.' });
    }

    const transactionId = String(req.body?.transactionId || '').trim();
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId wajib.' });
    }

    const response = await fetch(`${CASAKU_API}/api/generate/check-status`, {
      method: 'POST',
      headers: {
        'x-license-key': LICENSE_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ transactionId })
    });

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      return res.status(response.status || 502).json({
        error: payload.message || payload.error || 'Gagal mengecek status Casaku.'
      });
    }

    const data = payload.data || payload.result || {};
    const status = String(data.status || payload.status || '').toLowerCase();
    const amount = Number(data.amount || data.totalAmount || payload.amount || 0);
    const paidAt = data.paidAt || data.paid_at || new Date().toISOString();

    if (!status) {
      return res.status(502).json({ error: 'Status transaksi Casaku tidak ditemukan.' });
    }

    let order;
    if (status === 'paid') {
      order = await markPaidAndNotify(transactionId, amount, paidAt);
    } else {
      order = await updatePendingOrder(transactionId, status);
    }

    return res.status(200).json({
      success: true,
      status,
      order: order
        ? {
            id: order.id,
            status: order.status,
            paidAt: order.paidAt || null,
            product: order.product || null,
            deliveryLink: order.deliveryLink || ''
          }
        : null
    });
  } catch (error) {
    console.error('CASAKU STATUS ERROR', error);
    return res.status(500).json({
      error: error.message || 'Server error saat mengecek pembayaran.'
    });
  }
};

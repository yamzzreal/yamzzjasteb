const { jsonbin, save, clean } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const orderId = clean(body.orderId, 120);
    const transactionId = clean(body.transactionId, 180);
    const comment = clean(body.comment, 500);
    const rating = Number(body.rating);

    if (!orderId) {
      return res.status(400).json({ error: 'orderId wajib dikirim.' });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating harus berupa angka 1 sampai 5.' });
    }

    const db = await jsonbin();
    db.orders = Array.isArray(db.orders) ? db.orders : [];
    db.ratings = Array.isArray(db.ratings) ? db.ratings : [];

    const order = db.orders.find(item => String(item.id) === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }

    if (String(order.status || '').toLowerCase() !== 'paid') {
      return res.status(403).json({
        error: 'Rating hanya dapat diberikan setelah pembayaran berhasil.'
      });
    }

    const alreadyRated = db.ratings.some(item => String(item.orderId) === orderId);
    if (alreadyRated) {
      return res.status(409).json({ error: 'Pesanan ini sudah memberikan rating.' });
    }

    const ratingData = {
      id: `RATING-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      orderId,
      transactionId: transactionId || order.casakuTransactionId || '',
      rating,
      comment,
      customerName: order.name || 'Pelanggan',
      product: order.product || 'Produk',
      createdAt: new Date().toISOString()
    };

    db.ratings.unshift(ratingData);
    await save(db);

    return res.status(200).json({
      success: true,
      message: 'Rating berhasil disimpan.',
      rating: ratingData
    });
  } catch (error) {
    console.error('SUBMIT RATING ERROR', error);
    return res.status(500).json({
      error: error.message || 'Server error saat menyimpan rating.'
    });
  }
};

const { jsonbin } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await jsonbin();
    const ratings = Array.isArray(db.ratings) ? db.ratings : [];

    return res.status(200).json({
      success: true,
      ratings: ratings.map(item => ({
        id: item.id,
        rating: Number(item.rating) || 0,
        comment: item.comment || '',
        customerName: item.customerName || 'Pelanggan',
        product: item.product || 'Produk',
        createdAt: item.createdAt || null
      }))
    });
  } catch (error) {
    console.error('GET RATINGS ERROR', error);
    return res.status(500).json({
      error: error.message || 'Gagal mengambil rating.'
    });
  }
};

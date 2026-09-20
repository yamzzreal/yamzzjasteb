const { jsonbin } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = await jsonbin();
    const testimonials = Array.isArray(db.testimonials) ? db.testimonials : [];

    return res.status(200).json({
      success: true,
      testimonials: testimonials.map(item => ({
        id: item.id || '',
        name: item.name || 'Pelanggan',
        message: item.message || '',
        image: item.image || '',
        createdAt: item.createdAt || null
      }))
    });
  } catch (error) {
    console.error('GET TESTIMONIALS ERROR', error);
    return res.status(500).json({ error: error.message || 'Gagal mengambil testimoni.' });
  }
};

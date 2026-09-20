const {
  CASAKU_API,
  LICENSE_KEY,
  QRIS_ID,
  jsonbin,
  save,
  clean
} = require('./_common');
const { requireUser, privateDb, savePrivateDb, addNotification } = require('../auth/_common');

/*
 * ==============================
 * HELPER
 * ==============================
 */

function positiveNumber(...values) {
  for (const value of values) {
    const n = Number(value);

    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }

  return 0;
}

/**
 * Biaya admin acak berdasarkan harga produk.
 *
 * Di bawah Rp10.000:
 * Rp10 - Rp90, kelipatan Rp10.
 *
 * Rp10.000 atau lebih:
 * Rp100 - Rp900, kelipatan Rp100.
 */
function randomAdminFee(baseAmount) {
  if (baseAmount < 10000) {
    return (
      Math.floor(Math.random() * 9) + 1
    ) * 10;
  }

  return (
    Math.floor(Math.random() * 9) + 1
  ) * 100;
}

/**
 * Mencari object/data transaksi secara recursive.
 * Ini dibuat agar tetap kompatibel apabila response
 * Casaku dibungkus dalam data/result/response/etc.
 */
function findValueDeep(input, keys, maxDepth = 6, depth = 0) {
  if (!input || typeof input !== 'object' || depth > maxDepth) {
    return undefined;
  }

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(input, key) &&
      input[key] !== undefined &&
      input[key] !== null &&
      input[key] !== ''
    ) {
      return input[key];
    }
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findValueDeep(
        item,
        keys,
        maxDepth,
        depth + 1
      );

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  for (const value of Object.values(input)) {
    if (value && typeof value === 'object') {
      const found = findValueDeep(
        value,
        keys,
        maxDepth,
        depth + 1
      );

      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

function getTransactionId(payload) {
  const value = findValueDeep(payload, [
    'transactionId',
    'transaction_id',
    'trxId',
    'trx_id'
  ]);

  return String(value || '').trim();
}

function getQrString(payload) {
  const value = findValueDeep(payload, [
    'qr_string',
    'qrString',
    'qrCode',
    'qr_code',
    'qr'
  ]);

  return String(value || '').trim();
}

function getAmount(payload) {
  const value = findValueDeep(payload, [
    'totalAmount',
    'total_amount',
    'amount',
    'total'
  ]);

  return positiveNumber(value);
}

function getExpiredAt(payload) {
  const value = findValueDeep(payload, [
    'expiredAt',
    'expired_at',
    'expiresAt',
    'expires_at'
  ]);

  if (value) {
    return String(value);
  }

  return new Date(
    Date.now() + 15 * 60 * 1000
  ).toISOString();
}

/*
 * ==============================
 * MAIN HANDLER
 * ==============================
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    /*
     * ==============================
     * CEK KONFIGURASI
     * ==============================
     */

    if (!LICENSE_KEY || !QRIS_ID) {
      return res.status(500).json({
        error:
          'Casaku belum dikonfigurasi di Vercel. Isi CASAKU_LICENSE_KEY dan CASAKU_QRIS_ID.'
      });
    }

    /*
     * ==============================
     * DATA REQUEST
     * ==============================
     */

    const body = req.body || {};
    let authUser = null;
    try { authUser = (await requireUser(req))?.user || null; } catch {}

    const productId = clean(
      body.productId,
      100
    );

    if (!productId) {
      return res.status(400).json({
        error: 'productId wajib dikirim.'
      });
    }

    /*
     * ==============================
     * AMBIL PRODUK JSONBIN
     * ==============================
     */

    const db = await jsonbin();

    if (db.site?.maintenance === true) {
      return res.status(503).json({
        error: 'Website sedang maintenance.'
      });
    }

    if (db.site?.storeOffline === true) {
      return res.status(503).json({
        error: 'Store sedang offline.'
      });
    }

    const products = Array.isArray(db.products)
      ? db.products
      : [];

    const product = products.find(
      p => String(p.id) === productId
    );

    if (!product) {
      return res.status(404).json({
        error: 'Produk tidak ditemukan.'
      });
    }

    /*
     * ==============================
     * CEK STOK
     * ==============================
     */

    const currentStock = Number(
      product.stock ??
      product.stok ??
      product.quantity ??
      0
    );

    if (
      !Number.isFinite(currentStock) ||
      currentStock <= 0
    ) {
      return res.status(409).json({
        error: 'Stok produk habis.'
      });
    }

    /*
     * ==============================
     * HARGA PRODUK
     * ==============================
     */

    const baseAmount = Number(
      product.price
    );

    if (
      !Number.isFinite(baseAmount) ||
      baseAmount < 1
    ) {
      return res.status(400).json({
        error: 'Harga produk tidak valid.'
      });
    }

    /*
     * ==============================
     * BIAYA ADMIN ACAK
     * ==============================
     */

    const adminFee = randomAdminFee(
      baseAmount
    );

    const totalAmount =
      baseAmount + adminFee;

    console.log(
      'PAYMENT CALCULATION',
      {
        baseAmount,
        adminFee,
        totalAmount
      }
    );

    /*
     * ==============================
     * DATA CUSTOMER
     * ==============================
     */

    const customer = {
      name: clean(body.name, 80),
      whatsapp: clean(body.whatsapp, 25),
      email: clean(body.email, 120),
      note: clean(body.note, 300)
    };

    if (
      !customer.name ||
      !customer.whatsapp ||
      !customer.email
    ) {
      return res.status(400).json({
        error:
          'Nama, WhatsApp, dan email wajib diisi.'
      });
    }

    /*
     * ==============================
     * REQUEST KE CASAKU
     * ==============================
     */

    const gatewayPayload = {
      qr_id: QRIS_ID,

      // Harga produk + biaya admin
      amount: totalAmount,

      // Dimatikan agar tidak ada kode unik tambahan
      useUniqueCode: false,

      /*
       * Untuk testing kita gunakan DANA
       * sesuai contoh resmi Casaku.
       */
      packageIds: [
        'id.dana'
      ],

      expiredInMinutes: 15,

      qrType: 'dynamic',

      paymentMethod: 'qris',

      useQris: true,

      prefix: 'YMZZ'
    };

    console.log(
      'CASAKU REQUEST',
      gatewayPayload
    );

    const gatewayResponse = await fetch(
      `${CASAKU_API}/api/generate/v2/qris`,
      {
        method: 'POST',

        headers: {
          'x-license-key': LICENSE_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },

        body: JSON.stringify(
          gatewayPayload
        )
      }
    );

    /*
     * ==============================
     * BACA RESPONSE CASAKU
     * ==============================
     */

    const rawText =
      await gatewayResponse.text();

    let casaku = {};

    try {
      casaku = rawText
        ? JSON.parse(rawText)
        : {};
    } catch (error) {
      console.error(
        'CASAKU INVALID JSON',
        rawText
      );

      return res.status(502).json({
        error:
          'Casaku mengembalikan response bukan JSON.',

        httpStatus:
          gatewayResponse.status
      });
    }

    console.log(
      'CASAKU GENERATE RESPONSE',
      JSON.stringify(
        casaku,
        null,
        2
      )
    );

    /*
     * ==============================
     * CEK HTTP STATUS
     * ==============================
     */

    if (!gatewayResponse.ok) {
      return res.status(
        gatewayResponse.status || 502
      ).json({
        error:
          casaku.message ||
          casaku.error ||
          casaku.msg ||
          'Casaku gagal membuat QRIS.',

        casakuStatus:
          gatewayResponse.status,

        detail:
          casaku.data ||
          casaku.response ||
          null
      });
    }

    /*
     * ==============================
     * AMBIL DATA TRANSAKSI
     * ==============================
     */

    const transactionId =
      getTransactionId(casaku);

    const qrString =
      getQrString(casaku);

    const gatewayAmount =
      getAmount(casaku);

    const expiredAt =
      getExpiredAt(casaku);

    /*
     * ==============================
     * LOG HASIL PARSING
     * ==============================
     */

    console.log(
      'CASAKU PARSED',
      {
        transactionId:
          Boolean(transactionId),

        qrString:
          Boolean(qrString),

        gatewayAmount,

        expiredAt
      }
    );

    /*
     * ==============================
     * RESPONSE TIDAK LENGKAP
     * ==============================
     */

    if (
      !transactionId ||
      !qrString ||
      !gatewayAmount
    ) {
      console.error(
        'CASAKU INCOMPLETE RESPONSE',
        {
          transactionId,

          hasTransactionId:
            Boolean(transactionId),

          hasQrString:
            Boolean(qrString),

          gatewayAmount,

          responseKeys:
            Object.keys(casaku || {})
        }
      );

      return res.status(502).json({
        error:
          'Casaku berhasil merespons tetapi data transaksi tidak ditemukan.',

        casakuStatus:
          gatewayResponse.status,

        received: {
          transactionId:
            Boolean(transactionId),

          qrString:
            Boolean(qrString),

          amount:
            Boolean(gatewayAmount),

          topLevelFields:
            Object.keys(casaku || {})
        }
      });
    }

    /*
     * ==============================
     * BUAT ORDER
     * ==============================
     */

    const order = {
      id:
        `INV-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)
          .toUpperCase()}`,

      productId:
        product.id,

      product:
        product.name ||
        product.title ||
        'Produk',

      category:
        product.category ||
        'jasteb',

      // Link pengiriman otomatis; kosong = diproses admin.
      deliveryLink:
        clean(product.deliveryLink || product.productLink || product.link || '', 1000),

      ress:
        Number(product.ress || 0),

      quantity:
        1,

      /*
       * Nominal yang benar-benar
       * dikembalikan Casaku.
       */
      price:
        gatewayAmount,

      /*
       * Harga asli produk.
       */
      basePrice:
        baseAmount,

      /*
       * Biaya admin acak.
       */
      adminFee:
        adminFee,

      /*
       * Total pembayaran.
       */
      totalAmount:
        gatewayAmount,

      name:
        customer.name,

      whatsapp:
        customer.whatsapp,

      email:
        customer.email,

      userId:
        authUser?.id || null,

      note:
        customer.note,

      status:
        'pending',

      paymentGateway:
        'casaku',

      casakuTransactionId:
        transactionId,

      createdAt:
        new Date().toISOString(),

      expiredAt,

      paidAt:
        null,

      telegramNotifiedAt:
        null
    };

    /*
     * ==============================
     * SIMPAN KE JSONBIN
     * ==============================
     */

    db.orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    db.orders.unshift(order);

    await save(db);
    if (authUser?.id) {
      try {
        const pdb = await privateDb();
        addNotification(pdb, authUser.id, 'Transaksi dibuat', `Pembayaran ${order.id} untuk ${order.product} menunggu pembayaran.`, 'info');
        await savePrivateDb(pdb);
      } catch (notifyError) {
        console.error('USER NOTIFICATION CREATE ERROR', notifyError);
      }
    }

    /*
     * ==============================
     * RESPONSE KE FRONTEND
     * ==============================
     */

    return res.status(200).json({
      success: true,

      orderId:
        order.id,

      transactionId,

      amount:
        gatewayAmount,

      baseAmount,

      adminFee,

      totalAmount:
        gatewayAmount,

      qrString,

      expiredAt
    });

  } catch (error) {

    console.error(
      'CASAKU CREATE ERROR',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'Server error saat membuat pembayaran.'
    });
  }
};

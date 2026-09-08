/* YAMZZ MARKET — PAKASIR CHECKOUT */
"use strict";

const CONFIG = {
  HOME: "index.html",
  CREATE_API: "/api/pakasir/create"
};

let DB = { site: {}, products: [] };

const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

const rupiah = n => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(n) || 0);

function selected() {
  try {
    return JSON.parse(
      sessionStorage.getItem("yamzz_selected_product") ||
      sessionStorage.getItem("yamzz_checkout") || "null"
    );
  } catch {
    return null;
  }
}

async function getDB() {
  // Hanya memakai Access Key publik untuk membaca data.
  // Master Key tidak pernah ditaruh di browser.
  const bin = "6a97221eda38895dfe2c57b6";
  const access = "$2a$10$XkuvGHYPmOrDazsHVKoqU.0bp.DPZQuLg8.vDg7RYec1WaXBZiSE6";
  const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}/latest`, {
    headers: { "X-Access-Key": access }
  });
  if (!r.ok) throw new Error("Gagal memuat data toko.");
  return (await r.json()).record || {};
}

function render() {
  const p = selected();
  if (!p) {
    $("#paymentApp").innerHTML = `
      <div class="payment-empty">
        <h2>Produk belum dipilih</h2>
        <a href="${CONFIG.HOME}">Kembali ke toko</a>
      </div>`;
    return;
  }

  document.title = `Pembayaran • ${DB.site?.name || "Yamzz Market"}`;

  $("#paymentApp").innerHTML = `
    <main class="payment-wrap">
      <a class="back-link" href="${CONFIG.HOME}">
        <i class="fa-solid fa-arrow-left"></i> Kembali ke toko
      </a>

      <div class="payment-grid">
        <section class="payment-card">
          <div class="payment-head">
            <span class="badge">CHECKOUT PAKASIR</span>
            <h1>Data Pembeli</h1>
            <p>Isi data di bawah. Setelah itu kamu akan diarahkan ke halaman pembayaran Pakasir.</p>
          </div>

          <div class="selected-product">
            <div>${p.image
              ? `<img src="${esc(p.image)}" alt="">`
              : `<i class="fa-solid fa-bolt"></i>`}</div>
            <section>
              <span>${esc(p.category || "Jasteb")}</span>
              <strong>${esc(p.name)}</strong>
              <small>${Number(p.ress || 0)} Ress</small>
            </section>
            <b>${rupiah(p.price)}</b>
          </div>

          <form id="paymentForm">
            <label>Nama Pelanggan
              <input id="customerName" required maxlength="80" placeholder="Nama kamu">
            </label>

            <label>WhatsApp
              <input id="customerWhatsapp" required maxlength="20"
                inputmode="tel" placeholder="08xxxxxxxxxx">
            </label>

            <label>Email
              <input id="customerEmail" type="email" required maxlength="120"
                placeholder="email@contoh.com">
            </label>

            <label>Catatan (opsional)
              <textarea id="customerNote" rows="3" maxlength="300"
                placeholder="Catatan tambahan"></textarea>
            </label>

            <button class="payment-submit" type="submit">
              <i class="fa-solid fa-credit-card"></i>
              Lanjut ke Pembayaran
            </button>
          </form>

          <div id="paymentMessage"></div>
        </section>

        <aside class="payment-card qris-card">
          <div class="payment-head">
            <span class="badge">PAYMENT GATEWAY</span>
            <h2>Pakasir</h2>
            <p>QRIS akan ditampilkan langsung di halaman pembayaran Pakasir.</p>
          </div>

          <div class="qris-box">
            <div class="qris-missing">
              <i class="fa-solid fa-qrcode"></i>
              <span>QRIS Pakasir</span>
              <small>Pembayaran aman melalui halaman Pakasir.</small>
            </div>
          </div>

          <div class="amount-box">
            <span>Total Pembayaran</span>
            <strong>${rupiah(p.price)}</strong>
          </div>

          <div class="payment-note">
            <i class="fa-solid fa-circle-info"></i>
            <span>
              Setelah pembayaran berhasil, status transaksi akan otomatis berubah
              menjadi <b>Paid</b> melalui webhook.
            </span>
          </div>
        </aside>
      </div>
    </main>`;

  $("#paymentForm").onsubmit = submitPayment;
}

function showError(message) {
  $("#paymentMessage").innerHTML =
    `<div class="error-box">${esc(message)}</div>`;
}

async function submitPayment(e) {
  e.preventDefault();

  const btn = e.submitter;
  const msg = $("#paymentMessage");
  const p = selected();

  btn.disabled = true;
  btn.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i> Membuat pembayaran...`;
  msg.innerHTML = "";

  try {
    if (!p?.id) throw new Error("Produk checkout tidak valid.");

    const r = await fetch(CONFIG.CREATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: p.id,
        name: $("#customerName").value.trim(),
        whatsapp: $("#customerWhatsapp").value.trim(),
        email: $("#customerEmail").value.trim(),
        note: $("#customerNote").value.trim()
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.success) {
      throw new Error(data.error || "Gagal membuat pembayaran.");
    }

    sessionStorage.setItem("yamzz_last_order_id", data.order_id);
    sessionStorage.removeItem("yamzz_selected_product");
    sessionStorage.removeItem("yamzz_checkout");

    window.location.href = data.payment_url;
  } catch (err) {
    console.error(err);
    showError(err.message || "Terjadi kesalahan.");
    btn.disabled = false;
    btn.innerHTML =
      `<i class="fa-solid fa-credit-card"></i> Lanjut ke Pembayaran`;
  }
}

async function renderReturnState(orderId) {
  $("#paymentApp").innerHTML = `
    <main class="payment-wrap">
      <section class="payment-card" style="max-width:760px;margin:40px auto">
        <div class="payment-head">
          <span class="badge">TRANSAKSI</span>
          <h1>Pembayaran Selesai</h1>
          <p>ID transaksi kamu:</p>
          <h2>${esc(orderId)}</h2>
        </div>
        <div class="payment-note">
          <i class="fa-solid fa-circle-info"></i>
          <span>
            Webhook Pakasir akan memperbarui status secara otomatis.
            Kalau status masih pending, tunggu beberapa detik lalu cek kembali.
          </span>
        </div>
        <a class="payment-submit" style="display:block;text-align:center;text-decoration:none"
           href="cek-transaksi.html">
          <i class="fa-solid fa-magnifying-glass"></i> Cek Status Transaksi
        </a>
        <a class="back-link" style="display:block;margin-top:18px"
           href="${CONFIG.HOME}">Kembali ke toko</a>
      </section>
    </main>`;
}

async function init() {
  const params = new URLSearchParams(location.search);
  const returnedOrderId = params.get("order_id");

  if (returnedOrderId) {
    await renderReturnState(returnedOrderId);
    return;
  }

  try {
    DB = await getDB();
    render();
  } catch (e) {
    console.error(e);
    $("#paymentApp").innerHTML = `
      <div class="payment-empty">
        <h2>Gagal memuat pembayaran</h2>
        <p>Silakan refresh halaman.</p>
      </div>`;
  }
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();

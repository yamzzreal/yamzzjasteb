# Yamzz Market — Pakasir Payment Gateway

Integrasi ini mengubah checkout manual Yamzz Market menjadi alur pembayaran Pakasir:

1. Customer memilih produk.
2. `payment.html` mengirim data checkout ke `/api/pakasir/create`.
3. Server memvalidasi `productId` dan mengambil harga langsung dari JSONBin.
4. Server membuat order `pending`.
5. Customer diarahkan ke halaman pembayaran Pakasir (QRIS only).
6. Pakasir mengirim webhook ke `/api/pakasir/webhook`.
7. Server memverifikasi lagi transaksi ke Transaction Detail API Pakasir.
8. Jika valid, order berubah menjadi `paid`.
9. Customer dapat melihat status di `cek-transaksi.html`.

## Environment Variables Vercel

Tambahkan:

- `PAKASIR_PROJECT`
- `PAKASIR_API_KEY`
- `PAKASIR_REDIRECT_URL`
- `JSONBIN_BIN_ID`
- `JSONBIN_ACCESS_KEY`
- `JSONBIN_MASTER_KEY`

Jangan memasukkan API Key Pakasir atau Master Key JSONBin ke JavaScript frontend.

## Konfigurasi Pakasir

Webhook URL:

`https://DOMAIN-KAMU/api/pakasir/webhook`

Redirect URL:

`https://DOMAIN-KAMU/payment.html`

Sistem menggunakan URL payment Pakasir dengan `qris_only=1`, sehingga customer diarahkan langsung ke QRIS.

## Deploy Vercel

Upload project ini sebagai project Vercel. Folder `api/` otomatis menjadi Serverless Functions.

Setelah deploy:
1. Isi Environment Variables di Vercel.
2. Redeploy.
3. Di Pakasir, buka Project → Edit Project.
4. Isi Webhook URL dengan `/api/pakasir/webhook`.
5. Pastikan slug project dan API Key sesuai.
6. Tes menggunakan Sandbox/Payment Simulation sebelum live.

## Catatan penting

Project awal memakai JSONBin Master Key di `js/admin.js`. Itu tidak aman jika source code dapat diakses publik. Setelah integrasi ini aktif, pindahkan operasi admin write ke serverless API dan rotasi Master Key JSONBin yang lama.

Selain itu, cek kebijakan merchant Pakasir sebelum live. Dokumentasi Pakasir terbaru menyebut KYC wajib dan mereka membatasi beberapa kategori merchant digital. Pastikan layanan JASTEB yang dijual Yamzz Market diterima oleh Pakasir.

## Endpoint

- `POST /api/pakasir/create`
- `POST /api/pakasir/webhook`
- `GET /api/pakasir/status?order_id=...&amount=...`


## Notifikasi Telegram

Set environment variable berikut di Vercel:

```text
TELEGRAM_BOT_TOKEN=TOKEN_BOT_TELEGRAM
TELEGRAM_CHAT_ID=CHAT_ID_TUJUAN
```

Setelah webhook Pakasir berhasil memverifikasi transaksi sebagai `completed`, sistem akan mengubah order menjadi `paid` dan mengirim notifikasi pembayaran ke chat Telegram tersebut. Token bot hanya disimpan di environment server dan tidak ditaruh di frontend.

`TELEGRAM_CHAT_ID` bisa berupa chat ID pribadi, grup, atau channel tempat bot sudah ditambahkan dan memiliki izin mengirim pesan.

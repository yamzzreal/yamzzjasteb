# Yamzz Market × Casaku

## Environment Variables di Vercel
- `CASAKU_LICENSE_KEY` — License Key dari Casaku
- `CASAKU_QRIS_ID` — UUID QRIS merchant di Casaku
- `CASAKU_WEBHOOK_SECRET` — Webhook Secret dari Casaku
- `JSONBIN_BIN_ID` — ID JSONBin database
- `JSONBIN_MASTER_KEY` — Master Key JSONBin
- `TELEGRAM_BOT_TOKEN` — opsional, untuk notifikasi pembayaran
- `TELEGRAM_CHAT_ID` — opsional, untuk notifikasi pembayaran

## Webhook Casaku
Set URL webhook Casaku menjadi:
`https://DOMAIN-KAMU.vercel.app/api/casaku/webhook`

Jika domain custom:
`https://jasteb.yamzzoffc.my.id/api/casaku/webhook`

## Alur
1. Customer memilih produk.
2. Backend memvalidasi harga dari JSONBin (bukan dari browser).
3. Backend membuat QRIS dinamis Casaku.
4. Order disimpan dengan `casakuTransactionId`.
5. Customer scan QR.
6. Frontend polling status setiap 3 detik.
7. Casaku webhook menandai order `paid`.
8. Telegram dikirim sekali ketika order berubah menjadi paid.

## Penting
Jangan taruh License Key, Webhook Secret, atau JSONBin Master Key di JS frontend. Semua sudah dipindahkan ke Vercel Environment Variables.

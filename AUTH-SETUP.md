# Yamzz Market — User Account / Reseller Setup

Fitur baru:
- Login user dan Create Akun.
- Jenis akun Customer / Reseller.
- Upgrade Customer -> Reseller menggunakan QRIS Casaku.
- Profil user, notifikasi transaksi, notifikasi admin, dan chat admin.
- Admin > Akun untuk melihat transaksi, blokir/buka blokir, atur sandi, dan chat.
- Harga upgrade reseller dapat diatur dari Admin > Pengaturan.

## Vercel Environment Variables

Tambahkan:
- `YAMZZ_PRIVATE_BIN_ID` = ID JSONBin KHUSUS akun (buat bin baru, jangan gunakan bin publik produk).
- `YAMZZ_PRIVATE_MASTER_KEY` = Master Key JSONBin private tersebut.
- `YAMZZ_AUTH_SECRET` = string rahasia panjang, minimal 32 karakter.
- `YAMZZ_ADMIN_USERNAME` = username admin.
- `YAMZZ_ADMIN_PASSWORD` = password admin.

Variable Casaku yang sudah dipakai project tetap:
- `CASAKU_LICENSE_KEY`
- `CASAKU_QRIS_ID`
- `JSONBIN_BIN_ID`
- `JSONBIN_MASTER_KEY`

## Bentuk awal JSONBin private

Bin private boleh berisi:
```json
{
  "users": [],
  "notifications": [],
  "messages": [],
  "resellerPayments": []
}
```

Jangan menaruh Master Key private di HTML/JS.

## Setelah deploy

1. Login admin melalui `login.html`.
2. Buka Admin > Pengaturan.
3. Isi `Harga Upgrade Reseller (Rp)`.
4. Simpan.
5. Pelanggan buka `akun.html`, buat akun, login, lalu pilih Upgrade ke Reseller.
6. Setelah pembayaran Casaku terdeteksi PAID, status akun otomatis berubah menjadi Reseller dan notifikasi dikirim.

Catatan: akun yang melakukan checkout saat sudah login akan ditautkan ke transaksi melalui `userId`. Transaksi lama tanpa `userId` tetap dapat dicocokkan admin berdasarkan nomor WhatsApp.

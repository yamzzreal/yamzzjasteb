# Yamzz JASTEB — PHP + Vercel + QRIS Pribadi

Website marketplace JASTEB berbasis PHP untuk deployment Vercel dengan PostgreSQL sebagai storage durable.

## Fitur utama
- Landing/product page
- Produk: nama, harga, quota/ress, deskripsi, status aktif
- Produk frontend sinkron langsung dari database admin
- Checkout/payment page
- Form nama, email, WhatsApp, catatan
- **QRIS pribadi milik sendiri** tampil di halaman pembayaran
- **Upload bukti pembayaran** pelanggan (JPG/PNG/WEBP, maksimal 3 MB)
- Bukti pembayaran tersimpan di PostgreSQL sebagai data URI sehingga tidak bergantung pada filesystem Vercel
- **Verifikasi pembayaran dari Admin Panel**: Verifikasi / Tolak
- Kode transaksi otomatis
- Halaman cek status transaksi
- Admin login
- Admin CRUD produk
- Admin cek transaksi terbaru
- Admin melihat bukti pembayaran
- Admin ubah status: pending / paid / processing / completed / cancelled
- Admin setting nama website, tagline, WhatsApp, email, instruksi pembayaran
- Admin upload/ganti QRIS pribadi
- CSRF protection dan session cookie hardening

## Alur pembayaran
1. Pelanggan memilih paket JASTEB.
2. Pelanggan mengisi nama, email, dan WhatsApp.
3. Sistem membuat kode transaksi.
4. Halaman pembayaran menampilkan QRIS pribadi dan nominal yang harus dibayar.
5. Pelanggan membayar melalui QRIS pribadi.
6. Pelanggan upload screenshot/foto bukti pembayaran.
7. Transaksi masuk Admin Panel dengan status `pending`.
8. Admin membuka bukti pembayaran.
9. Jika pembayaran benar, admin klik **Verifikasi** → `paid`.
10. Admin dapat melanjutkan status ke `processing` → `completed`.
11. Jika bukti tidak valid, admin klik **Tolak** → `cancelled`.

## Penyimpanan QRIS dan bukti
File gambar QRIS dan bukti pembayaran dikonversi menjadi data URI dan disimpan di PostgreSQL. Ini dipilih agar versi dasar tidak membutuhkan filesystem persisten di Vercel.

Untuk trafik besar, lebih baik pindahkan file gambar ke object storage seperti Vercel Blob/S3-compatible storage dan simpan URL-nya di database.

## Environment Variables
Set di Vercel:

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Contoh ada di `.env.example`.

## Deploy
1. Buat database PostgreSQL (misalnya Neon, Supabase, atau provider PostgreSQL lain).
2. Masukkan `DATABASE_URL` ke Vercel Environment Variables.
3. Set `ADMIN_USERNAME` dan `ADMIN_PASSWORD` yang kuat.
4. Import repository/folder ini ke Vercel.
5. Deploy.
6. Buka `/admin`.
7. Login menggunakan akun admin.
8. Masuk ke **Setting → QRIS Pribadi**.
9. Upload gambar QRIS pribadi.
10. Atur nama website, WhatsApp, email, dan instruksi pembayaran.

Schema database dibuat otomatis saat request pertama. `sql/schema.sql` juga disediakan untuk setup manual.

## Catatan
Pembayaran pada versi ini adalah **QRIS manual**. Website tidak mengklaim pembayaran otomatis. Status `paid` hanya berubah ketika admin melakukan verifikasi.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  quota INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT UNIQUE NOT NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'QRIS',
  payment_proof_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at);

INSERT INTO settings(key,value) VALUES
  ('site_name','Yamzz Market'),
  ('site_tagline','JASTEB terpercaya & cepat'),
  ('contact_whatsapp',''),
  ('contact_email',''),
  ('qris_image_url',''),
  ('payment_note','Bayar sesuai nominal transaksi. Setelah pembayaran, simpan bukti pembayaran.'),
  ('currency','IDR')
ON CONFLICT(key) DO NOTHING;

INSERT INTO products(name,price,quota,description)
SELECT '10K 100 Ress',10000,100,'Paket 100 ress'
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO products(name,price,quota,description)
SELECT '15K 150 Ress',15000,150,'Paket 150 ress'
WHERE (SELECT COUNT(*) FROM products) = 1;

INSERT INTO products(name,price,quota,description)
SELECT '20K 200 Ress',20000,200,'Paket 200 ress'
WHERE (SELECT COUNT(*) FROM products) = 2;

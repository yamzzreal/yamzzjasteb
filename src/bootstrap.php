<?php
declare(strict_types=1);

/*
 * V3 bootstrap: no PHP filesystem sessions. Admin authentication and CSRF
 * state are stored in PostgreSQL so it survives Vercel container scaling.
 */

function envv(string $key, string $default = ''): string {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $url = envv('DATABASE_URL');
    if (!$url) throw new RuntimeException('DATABASE_URL belum diset di Vercel Environment Variables.');
    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) throw new RuntimeException('DATABASE_URL tidak valid.');
    $scheme = $parts['scheme'] ?? 'postgresql';
    if (!in_array($scheme, ['postgres', 'postgresql'], true)) throw new RuntimeException('Gunakan PostgreSQL DATABASE_URL.');
    $host = $parts['host'];
    $port = $parts['port'] ?? 5432;
    $dbn = ltrim($parts['path'] ?? '', '/');
    $user = $parts['user'] ?? '';
    $pass = $parts['pass'] ?? '';
    $dsn = "pgsql:host={$host};port={$port};dbname={$dbn};sslmode=require";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function json_out(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : ($_POST ?: []);
}

function secure_cookie(): bool {
    $proto = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    return $proto === 'https' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
}

function set_cookie(string $name, string $value, bool $httpOnly, int $maxAge = 86400): void {
    setcookie($name, $value, [
        'expires' => time() + $maxAge,
        'path' => '/',
        'secure' => secure_cookie(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ]);
}

function clear_cookie(string $name, bool $httpOnly = true): void {
    setcookie($name, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => secure_cookie(),
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ]);
}

function csrf(): string {
    if (!empty($_COOKIE['yamzz_csrf'])) return (string)$_COOKIE['yamzz_csrf'];
    $token = bin2hex(random_bytes(24));
    set_cookie('yamzz_csrf', $token, false, 86400);
    return $token;
}

function current_csrf(): string {
    return (string)($_COOKIE['yamzz_csrf'] ?? '');
}

function require_csrf(array $data): void {
    $token = (string)($data['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    $expected = current_csrf();
    if (!$token || !$expected || !hash_equals($expected, $token)) {
        json_out(['ok'=>false,'message'=>'CSRF token tidak valid. Refresh halaman lalu coba lagi.'], 419);
    }
}

function require_csrf_header(): void {
    require_csrf([]);
}

function admin_token(): string {
    return (string)($_COOKIE['yamzz_admin'] ?? '');
}

function admin_session(): ?array {
    $token = admin_token();
    if ($token === '' || !preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    $st = db()->prepare('SELECT token_hash, csrf_token, expires_at FROM admin_sessions WHERE token_hash=? AND expires_at > NOW() LIMIT 1');
    $st->execute([hash('sha256', $token)]);
    $row = $st->fetch();
    return $row ?: null;
}

function admin(): bool { return admin_session() !== null; }

function require_admin(): void {
    if (!admin()) json_out(['ok'=>false,'message'=>'Unauthorized'], 401);
}

function require_admin_csrf(array $data): void {
    require_admin();
    $token = (string)($data['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    $session = admin_session();
    if (!$session || !$token || !hash_equals((string)$session['csrf_token'], $token)) {
        json_out(['ok'=>false,'message'=>'CSRF admin tidak valid. Refresh panel lalu coba lagi.'], 419);
    }
}

function clean(string $s): string { return trim(strip_tags($s)); }
function rupiah(int|float $n): string { return 'Rp ' . number_format((float)$n, 0, ',', '.'); }

function ensure_schema(): void {
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')");
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, quota INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (id BIGSERIAL PRIMARY KEY, order_code TEXT UNIQUE NOT NULL, product_id BIGINT REFERENCES products(id) ON DELETE SET NULL, product_name TEXT NOT NULL, amount INTEGER NOT NULL, customer_name TEXT NOT NULL, email TEXT NOT NULL, whatsapp TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'QRIS', payment_proof_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    $pdo->exec("CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at)");
    $defaults = [
        'site_name'=>'Yamzz Market',
        'site_tagline'=>'JASTEB terpercaya & cepat',
        'contact_whatsapp'=>'',
        'contact_email'=>'',
        'qris_image_url'=>'',
        'payment_note'=>'Bayar sesuai nominal transaksi. Setelah pembayaran, simpan bukti pembayaran.',
        'currency'=>'IDR'
    ];
    $stmt = $pdo->prepare('INSERT INTO settings(key,value) VALUES(:k,:v) ON CONFLICT(key) DO NOTHING');
    foreach ($defaults as $k=>$v) $stmt->execute([':k'=>$k,':v'=>$v]);
    if ((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0) {
        $s=$pdo->prepare('INSERT INTO products(name,price,quota,description) VALUES(?,?,?,?)');
        foreach ([
            ['10K 100 Ress',10000,100,'Paket 100 ress'],
            ['15K 150 Ress',15000,150,'Paket 150 ress'],
            ['20K 200 Ress',20000,200,'Paket 200 ress']
        ] as $p) $s->execute($p);
    }
    $pdo->exec("DELETE FROM admin_sessions WHERE expires_at < NOW()");
}

function settings(): array {
    $out=[];
    foreach (db()->query('SELECT key,value FROM settings') as $r) $out[$r['key']]=$r['value'];
    return $out;
}

try {
    ensure_schema();
} catch (Throwable $e) {
    if (str_starts_with((string)($_SERVER['REQUEST_URI'] ?? ''), '/api/')) {
        json_out(['ok'=>false,'message'=>$e->getMessage()],500);
    }
}

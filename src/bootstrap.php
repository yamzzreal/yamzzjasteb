<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'samesite' => 'Lax'
    ]);
    session_start();
}

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
    $scheme = ($parts['scheme'] ?? 'postgresql');
    if (!in_array($scheme, ['postgres','postgresql'], true)) throw new RuntimeException('Gunakan PostgreSQL DATABASE_URL.');
    $host = $parts['host'];
    $port = $parts['port'] ?? 5432;
    $dbn = ltrim($parts['path'] ?? '', '/');
    $user = $parts['user'] ?? '';
    $pass = $parts['pass'] ?? '';
    $dsn = "pgsql:host={$host};port={$port};dbname={$dbn};sslmode=require";
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    return $pdo;
}

function json_out(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (is_array($data)) return $data;
    return $_POST ?: [];
}

function csrf(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}

function require_csrf(array $data): void {
    $token = $data['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!$token || !hash_equals($_SESSION['csrf'] ?? '', (string)$token)) json_out(['ok'=>false,'message'=>'CSRF token tidak valid.'], 419);
}

function require_csrf_header(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || !hash_equals($_SESSION['csrf'] ?? '', (string)$token)) json_out(['ok'=>false,'message'=>'CSRF token tidak valid.'], 419);
}

function admin(): bool { return !empty($_SESSION['admin']); }
function require_admin(): void { if (!admin()) json_out(['ok'=>false,'message'=>'Unauthorized'], 401); }
function clean(string $s): string { return trim(strip_tags($s)); }
function rupiah(int|float $n): string { return 'Rp ' . number_format((float)$n, 0, ',', '.'); }

function ensure_schema(): void {
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')");
    $pdo->exec("CREATE TABLE IF NOT EXISTS products (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, quota INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (id BIGSERIAL PRIMARY KEY, order_code TEXT UNIQUE NOT NULL, product_id BIGINT REFERENCES products(id) ON DELETE SET NULL, product_name TEXT NOT NULL, amount INTEGER NOT NULL, customer_name TEXT NOT NULL, email TEXT NOT NULL, whatsapp TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL DEFAULT 'QRIS', payment_proof_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    $defaults = ['site_name'=>'Yamzz Market','site_tagline'=>'JASTEB terpercaya & cepat','contact_whatsapp'=>'','contact_email'=>'','qris_image_url'=>'','payment_note'=>'Bayar sesuai nominal transaksi. Setelah pembayaran, simpan bukti pembayaran.','currency'=>'IDR'];
    $stmt = $pdo->prepare('INSERT INTO settings(key,value) VALUES(:k,:v) ON CONFLICT(key) DO NOTHING');
    foreach ($defaults as $k=>$v) $stmt->execute([':k'=>$k,':v'=>$v]);
    if ((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0) {
        $s=$pdo->prepare('INSERT INTO products(name,price,quota,description) VALUES(?,?,?,?)');
        foreach ([['10K 100 Ress',10000,100,'Paket 100 ress'],['15K 150 Ress',15000,150,'Paket 150 ress'],['20K 200 Ress',20000,200,'Paket 200 ress']] as $p) $s->execute($p);
    }
}

function settings(): array { $out=[]; foreach (db()->query('SELECT key,value FROM settings') as $r) $out[$r['key']]=$r['value']; return $out; }

try { ensure_schema(); } catch (Throwable $e) { if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) json_out(['ok'=>false,'message'=>$e->getMessage()],500); }

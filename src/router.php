<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/api/health') json_out(['ok'=>true,'service'=>'yamzz-jasteb','time'=>date('c')]);
if ($path === '/api/csrf' && $method === 'GET') json_out(['ok'=>true,'csrf'=>csrf()]);

if ($path === '/api/site' && $method === 'GET') {
    $pdo=db(); $s=settings();
    $products=$pdo->query('SELECT id,name,price,quota,description,active FROM products WHERE active=true ORDER BY price ASC,id ASC')->fetchAll();
    foreach($products as &$p){$p['id']=(int)$p['id'];$p['price']=(int)$p['price'];$p['quota']=(int)$p['quota'];}
    json_out(['ok'=>true,'settings'=>$s,'products'=>$products]);
}

if ($path === '/api/order' && $method === 'POST') {
    $d=body(); require_csrf($d);
    $pid=(int)($d['product_id']??0); $name=clean((string)($d['name']??''));
    $email=filter_var((string)($d['email']??''),FILTER_VALIDATE_EMAIL);
    $wa=clean((string)($d['whatsapp']??'')); $note=clean((string)($d['note']??''));
    if(!$pid||!$name||!$email||!$wa) json_out(['ok'=>false,'message'=>'Nama, email, WhatsApp, dan produk wajib diisi.'],422);
    $st=db()->prepare('SELECT * FROM products WHERE id=? AND active=true'); $st->execute([$pid]); $p=$st->fetch();
    if(!$p) json_out(['ok'=>false,'message'=>'Produk tidak tersedia.'],404);
    $code='JST-'.date('ymd').'-'.strtoupper(bin2hex(random_bytes(3)));
    $st=db()->prepare('INSERT INTO orders(order_code,product_id,product_name,amount,customer_name,email,whatsapp,note) VALUES(?,?,?,?,?,?,?,?) RETURNING order_code');
    $st->execute([$code,$p['id'],$p['name'],$p['price'],$name,$email,$wa,$note]);
    json_out(['ok'=>true,'order_code'=>$st->fetchColumn(),'amount'=>(int)$p['price'],'message'=>'Pesanan berhasil dibuat. Silakan bayar lalu upload bukti pembayaran.']);
}

if ($path === '/api/order-proof' && $method === 'POST') {
    require_csrf_header();
    $code=clean((string)($_POST['order_code']??''));
    if(!$code || empty($_FILES['proof'])) json_out(['ok'=>false,'message'=>'Kode transaksi dan bukti pembayaran wajib diisi.'],422);
    $file=$_FILES['proof'];
    if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK) json_out(['ok'=>false,'message'=>'Upload bukti pembayaran gagal.'],422);
    if(($file['size']??0)>3*1024*1024) json_out(['ok'=>false,'message'=>'Ukuran bukti maksimal 3 MB.'],422);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    if(!isset($allowed[$mime])) json_out(['ok'=>false,'message'=>'Format bukti harus JPG, PNG, atau WEBP.'],422);
    $data='data:'.$mime.';base64,'.base64_encode(file_get_contents($file['tmp_name']));
    $st=db()->prepare("UPDATE orders SET payment_proof_url=?, status='pending', updated_at=NOW() WHERE order_code=? RETURNING order_code");
    $st->execute([$data,$code]);
    if(!$st->fetchColumn()) json_out(['ok'=>false,'message'=>'Transaksi tidak ditemukan.'],404);
    json_out(['ok'=>true,'message'=>'Bukti pembayaran berhasil dikirim. Menunggu verifikasi admin.']);
}

if ($path === '/api/order-status' && $method === 'GET') {
    $code=clean((string)($_GET['code']??'')); if(!$code) json_out(['ok'=>false,'message'=>'Kode transaksi wajib diisi.'],422);
    $st=db()->prepare('SELECT order_code,product_name,amount,status,payment_proof_url,created_at,updated_at FROM orders WHERE order_code=?');
    $st->execute([$code]);$o=$st->fetch(); if(!$o) json_out(['ok'=>false,'message'=>'Transaksi tidak ditemukan.'],404);
    $o['amount']=(int)$o['amount']; $o['has_proof']=!empty($o['payment_proof_url']); unset($o['payment_proof_url']); json_out(['ok'=>true,'order'=>$o]);
}

if ($path === '/api/admin/login' && $method === 'POST') {
    $d=body(); require_csrf($d);
    $u=(string)($d['username']??'');
    $p=(string)($d['password']??'');
    $eu=envv('ADMIN_USERNAME','admin');
    $ep=envv('ADMIN_PASSWORD','change-me-now');
    if(hash_equals($eu,$u)&&hash_equals($ep,$p)){
        $rawToken=bin2hex(random_bytes(32));
        $csrfToken=bin2hex(random_bytes(24));
        $st=db()->prepare('INSERT INTO admin_sessions(token_hash,csrf_token,expires_at) VALUES(?,?,NOW()+INTERVAL \'7 days\')');
        $st->execute([hash('sha256',$rawToken),$csrfToken]);
        set_cookie('yamzz_admin',$rawToken,true,7*86400);
        set_cookie('yamzz_csrf',$csrfToken,false,7*86400);
        json_out(['ok'=>true,'csrf'=>$csrfToken]);
    }
    json_out(['ok'=>false,'message'=>'Username/password salah.'],401);
}
if ($path === '/api/admin/logout' && $method === 'POST') {
    require_admin_csrf(body());
    $token=admin_token();
    if($token) db()->prepare('DELETE FROM admin_sessions WHERE token_hash=?')->execute([hash('sha256',$token)]);
    clear_cookie('yamzz_admin',true); clear_cookie('yamzz_csrf',false);
    json_out(['ok'=>true]);
}

if (str_starts_with($path,'/api/admin/')) {
    require_admin();
    if ($path==='/api/admin/me' && $method==='GET') { $sess=admin_session(); json_out(['ok'=>true,'admin'=>true,'csrf'=>(string)$sess['csrf_token']]); }
    if ($path==='/api/admin/products' && $method==='GET') {
        $rows=db()->query('SELECT * FROM products ORDER BY id DESC')->fetchAll();
        foreach($rows as &$r){$r['id']=(int)$r['id'];$r['price']=(int)$r['price'];$r['quota']=(int)$r['quota'];$r['active']=(bool)$r['active'];}
        json_out(['ok'=>true,'products'=>$rows]);
    }
    if ($path==='/api/admin/product' && $method==='POST') {
        $d=body();require_admin_csrf($d);$id=(int)($d['id']??0);$name=clean((string)($d['name']??''));$price=max(0,(int)($d['price']??0));$quota=max(0,(int)($d['quota']??0));$desc=clean((string)($d['description']??''));$active=!empty($d['active']);
        if(!$name||$price<1)json_out(['ok'=>false,'message'=>'Nama dan harga wajib diisi.'],422);
        if($id){$st=db()->prepare('UPDATE products SET name=?,price=?,quota=?,description=?,active=?,updated_at=NOW() WHERE id=?');$st->execute([$name,$price,$quota,$desc,$active,$id]);}
        else{$st=db()->prepare('INSERT INTO products(name,price,quota,description,active) VALUES(?,?,?,?,?)');$st->execute([$name,$price,$quota,$desc,$active]);}json_out(['ok'=>true]);
    }
    if ($path==='/api/admin/product-delete' && $method==='POST') {$d=body();require_admin_csrf($d);$id=(int)($d['id']??0);db()->prepare('DELETE FROM products WHERE id=?')->execute([$id]);json_out(['ok'=>true]);}
    if ($path==='/api/admin/orders' && $method==='GET') {
        $rows=db()->query('SELECT id,order_code,product_name,amount,customer_name,email,whatsapp,note,payment_proof_url,status,created_at,updated_at FROM orders ORDER BY id DESC LIMIT 200')->fetchAll();
        foreach($rows as &$r){$r['amount']=(int)$r['amount'];$r['has_proof']=!empty($r['payment_proof_url']);}
        json_out(['ok'=>true,'orders'=>$rows]);
    }
    if ($path==='/api/admin/order-proof' && $method==='GET') {
        $code=clean((string)($_GET['code']??''));
        $st=db()->prepare('SELECT order_code,payment_proof_url FROM orders WHERE order_code=?');$st->execute([$code]);$o=$st->fetch();
        if(!$o || !$o['payment_proof_url']) json_out(['ok'=>false,'message'=>'Bukti pembayaran belum tersedia.'],404);
        json_out(['ok'=>true,'order_code'=>$o['order_code'],'proof'=>$o['payment_proof_url']]);
    }
    if ($path==='/api/admin/order-status' && $method==='POST') {
        $d=body();require_admin_csrf($d);$code=clean((string)($d['order_code']??''));$status=clean((string)($d['status']??''));
        $allowed=['pending','paid','processing','completed','cancelled'];
        if(!in_array($status,$allowed,true))json_out(['ok'=>false,'message'=>'Status tidak valid.'],422);
        $st=db()->prepare('UPDATE orders SET status=?,updated_at=NOW() WHERE order_code=? RETURNING order_code');$st->execute([$status,$code]);
        if(!$st->fetchColumn()) json_out(['ok'=>false,'message'=>'Transaksi tidak ditemukan.'],404); json_out(['ok'=>true]);
    }
    if ($path==='/api/admin/settings' && $method==='GET') { $sess=admin_session(); json_out(['ok'=>true,'settings'=>settings(),'csrf'=>(string)$sess['csrf_token']]); }
    if ($path==='/api/admin/settings' && $method==='POST') {
        $d=body();require_admin_csrf($d);unset($d['csrf']);
        $st=db()->prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value');
        foreach($d as $k=>$v){if(in_array($k,['site_name','site_tagline','contact_whatsapp','contact_email','payment_note'],true))$st->execute([$k,clean((string)$v)]);}
        json_out(['ok'=>true,'settings'=>settings()]);
    }
    if ($path==='/api/admin/qris-upload' && $method==='POST') {
        require_admin_csrf([]);
        if(empty($_FILES['qris'])) json_out(['ok'=>false,'message'=>'File QRIS wajib dipilih.'],422);
        $file=$_FILES['qris'];
        if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK) json_out(['ok'=>false,'message'=>'Upload QRIS gagal.'],422);
        if(($file['size']??0)>3*1024*1024) json_out(['ok'=>false,'message'=>'Ukuran QRIS maksimal 3 MB.'],422);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $allowed=['image/jpeg','image/png','image/webp']; if(!in_array($mime,$allowed,true)) json_out(['ok'=>false,'message'=>'Format QRIS harus JPG, PNG, atau WEBP.'],422);
        $data='data:'.$mime.';base64,'.base64_encode(file_get_contents($file['tmp_name']));
        $st=db()->prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value');$st->execute(['qris_image_url',$data]);
        json_out(['ok'=>true,'message'=>'QRIS berhasil diperbarui.']);
    }
}

if ($path === '/admin' || $path === '/admin/' || $path === '/payment' || $path === '/status' || $path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__.'/../public/index.html'); exit;
}
http_response_code(404); echo 'Not Found';

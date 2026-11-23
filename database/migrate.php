<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden: CLI only.');
}

define('TARAKOTA_APP', true);
require_once dirname(__DIR__) . '/config/database.php';

$host = tarakota_env('TARAKOTA_DB_HOST', '127.0.0.1');
$port = tarakota_env('TARAKOTA_DB_PORT', '3306');
$user = tarakota_env('TARAKOTA_DB_USER', 'root');
$pass = tarakota_env('TARAKOTA_DB_PASS', '');

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port),
    $user,
    $pass,
    [
        PDO::ATTR_ERRMODE          => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);

$sql = file_get_contents(__DIR__ . '/schema.sql');
if ($sql === false) {
    fwrite(STDERR, "Failed to read schema.sql\n");
    exit(1);
}

$normalized = str_replace("\r\n", "\n", $sql);
$withoutComments = preg_replace('/^\s*--.*$/m', '', $normalized) ?? $normalized;
$statements = array_filter(
    array_map('trim', explode(";\n", $withoutComments . "\n")),
    static fn (string $s): bool => $s !== ''
);

foreach ($statements as $stmt) {
    $pdo->exec($stmt);
}

// Ensure incremental migration for existing databases
try {
    $cols = $pdo->query("SHOW COLUMNS FROM `transaksi_tiket`")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('kode_unik', $cols, true)) {
        $pdo->exec("ALTER TABLE `transaksi_tiket` ADD COLUMN `kode_unik` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `total_harga`");
    }
    if (!in_array('expires_at', $cols, true)) {
        $pdo->exec("ALTER TABLE `transaksi_tiket` ADD COLUMN `expires_at` TIMESTAMP NULL AFTER `status`");
    }
    $pdo->exec("ALTER TABLE `transaksi_tiket` MODIFY COLUMN `status` ENUM('pending', 'paid', 'cancelled', 'expired') NOT NULL DEFAULT 'pending'");
} catch (Throwable $e) {
    // Table schema already handled by schema.sql
}

echo "Migration and seed completed successfully.\n";

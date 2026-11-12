<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden: Direct script access is not allowed.');
}

/**
 * Reads DB settings from process environment first, then optional project .env file.
 */
function tarakota_load_dotenv(): array
{
    static $parsed = null;
    if (is_array($parsed)) {
        return $parsed;
    }

    $parsed = [];
    $envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envPath) || !is_readable($envPath)) {
        return $parsed;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return $parsed;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $trimmed, 2);
        $key = trim($k);
        $val = trim($v);
        if ((str_starts_with($val, '"') && str_ends_with($val, '"'))
            || (str_starts_with($val, "'") && str_ends_with($val, "'"))
        ) {
            $val = substr($val, 1, -1);
        }
        if ($key !== '') {
            $parsed[$key] = $val;
        }
    }

    return $parsed;
}

function tarakota_env(string $key, string $default = ''): string
{
    $val = getenv($key);
    if ($val !== false) {
        return $val;
    }
    $dotenv = tarakota_load_dotenv();
    return array_key_exists($key, $dotenv) ? $dotenv[$key] : $default;
}

/**
 * Returns a shared PDO MySQL connection configured with strict prepared statements.
 */
function tarakota_db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = tarakota_env('TARAKOTA_DB_HOST') ?: '127.0.0.1';
    $port = tarakota_env('TARAKOTA_DB_PORT') ?: '3306';
    $dbName = tarakota_env('TARAKOTA_DB_NAME') ?: 'tarakota_fest_2026';
    $user = tarakota_env('TARAKOTA_DB_USER') ?: 'root';
    $pass = tarakota_env('TARAKOTA_DB_PASS', '');

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $host,
        $port,
        $dbName
    );

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}


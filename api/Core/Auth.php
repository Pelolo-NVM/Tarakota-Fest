<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class Auth
{
    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            $savePath = (string) session_save_path();
            if ($savePath === '' || !is_dir($savePath) || !is_writable($savePath)) {
                $fallback = sys_get_temp_dir();
                if (is_dir($fallback) && is_writable($fallback)) {
                    session_save_path($fallback);
                }
            }
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'path'     => '/',
            ]);
            session_start();
        }
    }

    public static function user(): ?array
    {
        self::startSession();
        $user = $_SESSION['admin_user'] ?? null;
        return is_array($user) ? $user : null;
    }

    public static function loginUser(array $userRow): void
    {
        self::startSession();
        if (!headers_sent()) {
            header_remove('Set-Cookie');
        }
        session_regenerate_id(true);
        $_SESSION['admin_user'] = [
            'id'    => (int) $userRow['id'],
            'name'  => (string) $userRow['name'],
            'email' => (string) $userRow['email'],
            'role'  => (string) $userRow['role'],
        ];
    }

    public static function logout(): void
    {
        self::startSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                (bool) $params['secure'],
                (bool) $params['httponly']
            );
        }
        session_destroy();
    }

    public static function requireLogin(): array
    {
        $user = self::user();
        if ($user === null) {
            Response::error(401, 'Silakan login terlebih dahulu.');
        }
        return $user;
    }

    public static function requireRole(array $roles): array
    {
        $user = self::requireLogin();
        if (!in_array($user['role'] ?? '', $roles, true)) {
            Response::error(403, 'Akses ditolak: Role Anda (' . ($user['role'] ?? 'guest') . ') tidak memiliki izin untuk aksi ini.');
        }
        return $user;
    }

    public static function requireAdmin(): array
    {
        return self::requireRole(['admin']);
    }
}


<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class AuthController
{
    public static function login(PDO $pdo): never
    {
        $input = Response::readInput();
        $email = strtolower(Validator::cleanString($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        if (!Validator::isEmail($email) || $password === '') {
            Response::error(422, 'Email dan kata sandi wajib diisi dengan format yang benar.', [
                'credentials' => 'Masukkan email dan kata sandi administrator.',
            ]);
        }

        $stmt = $pdo->prepare(
            "SELECT id, nama AS name, email, password_hash, role, is_active
             FROM users
             WHERE email = :email AND role = 'admin' AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            Response::error(401, 'Email atau kata sandi admin salah.', [
                'credentials' => 'Gunakan akun administrator yang terdaftar.',
            ]);
        }

        Auth::loginUser($user);
        Response::ok(200, Auth::user(), 'Autentikasi berhasil.');
    }

    public static function logout(): never
    {
        Auth::logout();
        Response::ok(200, null, 'Sesi administrator berhasil ditutup.');
    }

    public static function session(): never
    {
        Response::ok(200, Auth::user());
    }
}

<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class AuthController
{
    public static function login(PDO $pdo, bool $adminOnly = false): never
    {
        $input = Response::readInput();
        $email = strtolower(Validator::cleanString($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        if (!Validator::isEmail($email) || $password === '') {
            Response::error(422, 'Email dan kata sandi wajib diisi dengan format yang benar.', [
                'credentials' => 'Masukkan email dan kata sandi akun terdaftar.',
            ]);
        }

        $stmt = $pdo->prepare(
            "SELECT id, nama AS name, email, password_hash, role, is_active
             FROM users
             WHERE email = :email AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        // Verifikasi password hashing menggunakan password_verify (Langkah D.2 Modul 12)
        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            Response::error(401, 'Email atau kata sandi salah.', [
                'credentials' => 'Kredensial login tidak cocok.',
            ]);
        }

        // Pengecekan otorisasi jika akses ditujukan khusus portal admin (Langkah D.4)
        if ($adminOnly && ($user['role'] ?? '') !== 'admin') {
            Response::error(403, 'Akses ditolak: Akun ini tidak memiliki hak akses administrator.', [
                'role' => 'Hanya akun ber-role admin yang diizinkan masuk portal.',
            ]);
        }

        Auth::loginUser($user);
        $userData = Auth::user() ?? [];
        $userData['csrfToken'] = Auth::csrfToken();
        Response::ok(200, $userData, 'Autentikasi berhasil.');
    }

    public static function register(PDO $pdo): never
    {
        $input = Response::readInput();
        $nama = Validator::cleanString($input['nama'] ?? $input['name'] ?? '');
        $email = strtolower(Validator::cleanString($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        $errors = [];
        if ($nama === '' || mb_strlen($nama) < 3 || mb_strlen($nama) > 100) {
            $errors['nama'] = 'Nama lengkap wajib diisi (3 - 100 karakter).';
        }
        if (!Validator::isEmail($email) || mb_strlen($email) > 150) {
            $errors['email'] = 'Alamat email wajib valid dan maksimal 150 karakter.';
        }
        if (mb_strlen($password) < 6) {
            $errors['password'] = 'Kata sandi minimal 6 karakter.';
        }

        if (!empty($errors)) {
            Response::error(422, 'Data registrasi tidak memenuhi syarat.', $errors);
        }

        // Cek duplikasi email
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkStmt->execute(['email' => $email]);
        if ($checkStmt->fetch()) {
            Response::error(422, 'Alamat email sudah terdaftar.', [
                'email' => 'Silakan gunakan email lain atau login langsung.',
            ]);
        }

        // Hashing password dengan PASSWORD_DEFAULT / BCrypt (Langkah D.1 Modul 12)
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $insertStmt = $pdo->prepare(
            'INSERT INTO users (nama, email, password_hash, role, is_active)
             VALUES (:nama, :email, :password_hash, :role, 1)'
        );
        $insertStmt->execute([
            'nama'          => $nama,
            'email'         => $email,
            'password_hash' => $passwordHash,
            'role'          => 'user',
        ]);

        $newId = (int) $pdo->lastInsertId();

        Response::ok(201, [
            'id'    => $newId,
            'name'  => $nama,
            'email' => $email,
            'role'  => 'user',
        ], 'Akun pengguna berhasil didaftarkan.');
    }

    public static function me(PDO $pdo): never
    {
        // Memastikan sesi terautentikasi (401 jika belum login)
        $authUser = Auth::requireLogin();

        $stmt = $pdo->prepare(
            'SELECT id, nama AS name, email, role, is_active, created_at
             FROM users
             WHERE id = :id AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['id' => $authUser['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            Auth::logout();
            Response::error(401, 'Sesi tidak valid. Pengguna tidak ditemukan.');
        }

        // Pastikan password_hash TIDAK PERNAH dikembalikan (Latihan E.2 Modul 12)
        unset($user['password_hash']);

        $user['id'] = (int) $user['id'];
        $user['is_active'] = (bool) $user['is_active'];
        $user['csrfToken'] = Auth::csrfToken();

        Response::ok(200, $user, 'Data profil pengguna aktif.');
    }

    public static function logout(): never
    {
        Auth::logout();
        Response::ok(200, null, 'Sesi berhasil ditutup.');
    }

    public static function session(): never
    {
        $curr = Auth::user();
        if ($curr !== null) {
            $curr['csrfToken'] = Auth::csrfToken();
        }
        Response::ok(200, $curr);
    }
}

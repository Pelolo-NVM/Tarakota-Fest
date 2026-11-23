<?php
declare(strict_types=1);

final class UserController
{
    public static function list(PDO $pdo): never
    {
        Auth::requireAdmin();

        $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: 1;
        $limit = filter_var($_GET['limit'] ?? 50, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]) ?: 50;
        $search = Validator::cleanString($_GET['search'] ?? '');
        $role = Validator::cleanString($_GET['role'] ?? 'ALL');

        $where = ['1=1'];
        $params = [];

        if ($search !== '') {
            $where[] = '(nama LIKE :search OR email LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }
        if ($role !== '' && $role !== 'ALL') {
            $where[] = 'role = :role';
            $params['role'] = $role;
        }

        $whereClause = implode(' AND ', $where);

        $paged = Paginator::fetchPaginated(
            $pdo,
            "SELECT COUNT(*) FROM users WHERE $whereClause",
            "SELECT id, nama, email, role, is_active, created_at FROM users WHERE $whereClause ORDER BY id ASC",
            $params,
            static fn (array $r): array => [
                'id'        => (int) $r['id'],
                'nama'      => (string) $r['nama'],
                'email'     => (string) $r['email'],
                'role'      => (string) $r['role'],
                'isActive'  => (bool) $r['is_active'],
                'createdAt' => (string) $r['created_at'],
            ],
            $limit
        );

        Response::ok(200, $paged);
    }

    public static function create(PDO $pdo): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();

        $nama = Validator::cleanString($input['nama'] ?? $input['name'] ?? '');
        $email = strtolower(Validator::cleanString($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $role = strtolower(Validator::cleanString($input['role'] ?? 'user'));

        if (!in_array($role, ['admin', 'user'], true)) {
            $role = 'user';
        }

        $errors = [];
        if (mb_strlen($nama) < 2) {
            $errors['nama'] = 'Nama lengkap minimal 2 karakter.';
        }
        if (!Validator::isEmail($email)) {
            $errors['email'] = 'Format email tidak valid.';
        }
        if (mb_strlen($password) < 6) {
            $errors['password'] = 'Kata sandi minimal 6 karakter.';
        }

        if ($errors !== []) {
            Response::error(422, 'Validasi pembuatan pengguna gagal.', $errors);
        }

        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkStmt->execute(['email' => $email]);
        if ($checkStmt->fetch()) {
            Response::error(422, 'Alamat email sudah terdaftar.', ['email' => 'Email ini sudah digunakan oleh akun lain.']);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $insert = $pdo->prepare(
            'INSERT INTO users (nama, email, password_hash, role, is_active)
             VALUES (:nama, :email, :password_hash, :role, 1)'
        );
        $insert->execute([
            'nama'          => $nama,
            'email'         => $email,
            'password_hash' => $hash,
            'role'          => $role,
        ]);

        $newId = (int) $pdo->lastInsertId();
        Response::ok(201, [
            'id'        => $newId,
            'nama'      => $nama,
            'email'     => $email,
            'role'      => $role,
            'isActive'  => true,
            'createdAt' => date('Y-m-d H:i:s'),
        ], 'User baru berhasil didaftarkan oleh admin.');
    }

    public static function toggleStatus(PDO $pdo, int $userId): never
    {
        Auth::requireAdmin();

        $stmt = $pdo->prepare('SELECT id, is_active, role FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        $target = $stmt->fetch();

        if (!$target) {
            Response::error(404, 'User tidak ditemukan.');
        }

        // Prevent admin from deactivating themselves
        $curr = Auth::user();
        if ($curr && (int) $curr['id'] === $userId) {
            Response::error(422, 'Anda tidak dapat menonaktifkan akun sendiri.');
        }

        $newStatus = (int) $target['is_active'] === 1 ? 0 : 1;
        $upd = $pdo->prepare('UPDATE users SET is_active = :status WHERE id = :id');
        $upd->execute(['status' => $newStatus, 'id' => $userId]);

        Response::ok(200, [
            'id'       => $userId,
            'isActive' => $newStatus === 1,
        ], 'Status keaktifan user berhasil diperbarui.');
    }
}

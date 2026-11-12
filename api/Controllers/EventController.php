<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class EventController
{
    public static function mapEventRow(array $row): array
    {
        $thumb = trim((string) ($row['poster_url'] ?? ''));
        return [
            'id'             => (string) $row['kode_event'],
            'title'          => (string) $row['nama'],
            'category'       => (string) $row['kategori'],
            'dateLabel'      => (string) $row['tanggal_label'],
            'price'          => (int) round((float) $row['harga']),
            'totalQuota'     => (int) $row['kapasitas'],
            'remainingQuota' => (int) $row['sisa_kuota'],
            'thumbnail'      => $thumb !== '' ? $thumb : 'assets/images/placeholder-ticket.svg',
            'description'    => (string) ($row['deskripsi'] ?? ''),
            'status'         => (string) $row['status'],
        ];
    }

    /**
     * @return array{0: array{title: string, category: string, dateLabel: string, price: int, totalQuota: int, description: string}, 1: array<string, string>}
     */
    private static function validateEventFields(array $input): array
    {
        $title = Validator::cleanString($input['title'] ?? '');
        $category = Validator::cleanString($input['category'] ?? '');
        $dateLabel = Validator::cleanString($input['dateLabel'] ?? '');
        $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_INT);
        $totalQuota = filter_var($input['totalQuota'] ?? null, FILTER_VALIDATE_INT);
        $description = Validator::cleanString($input['description'] ?? '');

        $errors = [];
        if (mb_strlen($title) < 3) {
            $errors['title'] = 'Nama event minimal 3 karakter.';
        }
        if (mb_strlen($category) < 2) {
            $errors['category'] = 'Kategori event wajib diisi.';
        }
        if (mb_strlen($dateLabel) < 3) {
            $errors['dateLabel'] = 'Tanggal pelaksanaan wajib diisi.';
        }
        if ($price === false || $price <= 0) {
            $errors['price'] = 'Harga tiket harus lebih dari 0.';
        }
        if ($totalQuota === false || $totalQuota <= 0) {
            $errors['totalQuota'] = 'Kuota total harus bilangan bulat positif.';
        }

        return [
            [
                'title'       => $title,
                'category'    => $category,
                'dateLabel'   => $dateLabel,
                'price'       => $price !== false ? (int) $price : 0,
                'totalQuota'  => $totalQuota !== false ? (int) $totalQuota : 0,
                'description' => $description,
            ],
            $errors,
        ];
    }

    public static function list(PDO $pdo, bool $includeCancelled): never
    {
        $rawStatus = strtolower(Validator::cleanString($_GET['status'] ?? 'all'));
        $search = Validator::cleanString($_GET['search'] ?? '');

        if ($rawStatus !== '' && $rawStatus !== 'all' && !in_array($rawStatus, ['active', 'cancelled', 'completed'], true)) {
            Response::error(400, 'Parameter filter status event tidak valid.', [
                'status' => 'Gunakan all, active, cancelled, atau completed.',
            ]);
        }

        $where = ['is_active = 1'];
        $params = [];
        if ($includeCancelled) {
            Auth::requireAdmin();
            if ($rawStatus !== '' && $rawStatus !== 'all') {
                $where[] = 'status = :status';
                $params['status'] = $rawStatus;
            }
        } else {
            $where[] = "status = 'active'";
        }

        if ($search !== '') {
            $where[] = '(kode_event LIKE :s_code OR nama LIKE :s_title OR kategori LIKE :s_cat OR deskripsi LIKE :s_desc)';
            $like = '%' . $search . '%';
            $params['s_code'] = $like;
            $params['s_title'] = $like;
            $params['s_cat'] = $like;
            $params['s_desc'] = $like;
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);
        $paged = Paginator::fetchPaginated(
            $pdo,
            "SELECT COUNT(*) FROM events {$whereSql}",
            "SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
             FROM events
             {$whereSql}
             ORDER BY id ASC",
            $params,
            self::mapEventRow(...)
        );

        Response::ok(200, $paged);
    }

    public static function show(PDO $pdo, string $eventCode): never
    {
        $stmt = $pdo->prepare(
            'SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
             FROM events
             WHERE kode_event = :code AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['code' => $eventCode]);
        $row = $stmt->fetch();

        $user = Auth::user();
        $isAdmin = $user !== null && ($user['role'] ?? '') === 'admin';
        if (!$row || ((string) $row['status'] !== 'active' && !$isAdmin)) {
            Response::error(404, 'Event tidak ditemukan.');
        }

        Response::ok(200, self::mapEventRow($row));
    }

    public static function create(PDO $pdo): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();
        [$fields, $errors] = self::validateEventFields($input);

        $upload = FileUploader::handleUpload('posterFile', 'posters', false);
        if (!$upload['ok']) {
            $errors['posterFile'] = $upload['error'] ?? 'Gagal memproses poster event.';
        }

        if ($errors !== []) {
            if (!empty($upload['path'])) {
                FileUploader::removePublicFile($upload['path']);
            }
            Response::error(422, 'Validasi event gagal. Periksa kembali kolom yang ditandai.', $errors);
        }

        $posterPath = $upload['path'] ?? 'assets/images/placeholder-ticket.svg';
        $descFinal = $fields['description'] !== '' ? $fields['description'] : 'Tiket resmi Tarakota Fest 2026.';

        $pdo->beginTransaction();
        try {
            $maxStmt = $pdo->prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM events FOR UPDATE');
            $maxStmt->execute();
            $nextNum = ((int) $maxStmt->fetchColumn()) + 1;
            $eventCode = sprintf('EVT-%02d', $nextNum);

            $ins = $pdo->prepare(
                'INSERT INTO events (kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status, is_active)
                 VALUES (:kode_event, :nama, :kategori, :tanggal_label, :harga, :kapasitas, :sisa_kuota, :poster_url, :deskripsi, :status, 1)'
            );
            $ins->execute([
                'kode_event'    => $eventCode,
                'nama'          => $fields['title'],
                'kategori'      => $fields['category'],
                'tanggal_label' => $fields['dateLabel'],
                'harga'         => number_format($fields['price'], 2, '.', ''),
                'kapasitas'     => $fields['totalQuota'],
                'sisa_kuota'    => $fields['totalQuota'],
                'poster_url'    => $posterPath,
                'deskripsi'     => $descFinal,
                'status'        => 'active',
            ]);

            $fetch = $pdo->prepare(
                'SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
                 FROM events WHERE kode_event = :code LIMIT 1'
            );
            $fetch->execute(['code' => $eventCode]);
            $created = $fetch->fetch();
            $pdo->commit();

            Response::ok(201, self::mapEventRow($created), 'Event baru berhasil ditambahkan.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if (!empty($upload['path'])) {
                FileUploader::removePublicFile($upload['path']);
            }
            Response::error(500, 'Gagal menyimpan event ke database.');
        }
    }

    public static function update(PDO $pdo, string $eventCode, bool $isPatch = false): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();
        $hasFileUpload = isset($_FILES['posterFile']) && is_array($_FILES['posterFile'])
            && ((int) ($_FILES['posterFile']['error'] ?? UPLOAD_ERR_NO_FILE)) !== UPLOAD_ERR_NO_FILE;

        if ($isPatch && $input === [] && !$hasFileUpload) {
            Response::error(422, 'Minimal satu field pembaruan wajib dikirim.');
        }

        $uploadedPath = '';
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'SELECT id, kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi
                 FROM events
                 WHERE kode_event = :code AND is_active = 1
                 FOR UPDATE'
            );
            $stmt->execute(['code' => $eventCode]);
            $existing = $stmt->fetch();

            if (!$existing) {
                $pdo->rollBack();
                Response::error(404, 'Event tidak ditemukan.');
            }

            $candidate = $input;
            if ($isPatch) {
                $patchDefaults = [
                    'title'       => (string) $existing['nama'],
                    'category'    => (string) $existing['kategori'],
                    'dateLabel'   => (string) $existing['tanggal_label'],
                    'price'       => (int) round((float) $existing['harga']),
                    'totalQuota'  => (int) $existing['kapasitas'],
                    'description' => (string) ($existing['deskripsi'] ?? ''),
                ];
                foreach ($patchDefaults as $apiKey => $fallbackVal) {
                    if (!array_key_exists($apiKey, $candidate)) {
                        $candidate[$apiKey] = $fallbackVal;
                    }
                }
            }

            [$fields, $errors] = self::validateEventFields($candidate);

            $upload = FileUploader::handleUpload('posterFile', 'posters', false);
            if (!$upload['ok']) {
                $errors['posterFile'] = $upload['error'] ?? 'Gagal memproses poster event.';
            } elseif (!empty($upload['path'])) {
                $uploadedPath = (string) $upload['path'];
            }

            $usedQuota = max(0, (int) $existing['kapasitas'] - (int) $existing['sisa_kuota']);
            if (!isset($errors['totalQuota']) && $fields['totalQuota'] < $usedQuota) {
                $errors['totalQuota'] = 'Kuota total tidak boleh kurang dari tiket yang sudah terpakai (' . $usedQuota . ').';
            }

            if ($errors !== []) {
                $pdo->rollBack();
                if ($uploadedPath !== '') {
                    FileUploader::removePublicFile($uploadedPath);
                }
                Response::error(422, 'Pembaruan event gagal divalidasi.', $errors);
            }

            $nextRemaining = $fields['totalQuota'] - $usedQuota;
            $nextPoster = $uploadedPath !== '' ? $uploadedPath : (string) ($existing['poster_url'] ?? 'assets/images/placeholder-ticket.svg');
            $nextDesc = $fields['description'] !== '' ? $fields['description'] : (string) ($existing['deskripsi'] ?? '');

            $upd = $pdo->prepare(
                'UPDATE events
                 SET nama = :nama,
                     kategori = :kategori,
                     tanggal_label = :tanggal_label,
                     harga = :harga,
                     kapasitas = :kapasitas,
                     sisa_kuota = :sisa_kuota,
                     poster_url = :poster_url,
                     deskripsi = :deskripsi
                 WHERE id = :id'
            );
            $upd->execute([
                'nama'          => $fields['title'],
                'kategori'      => $fields['category'],
                'tanggal_label' => $fields['dateLabel'],
                'harga'         => number_format($fields['price'], 2, '.', ''),
                'kapasitas'     => $fields['totalQuota'],
                'sisa_kuota'    => $nextRemaining,
                'poster_url'    => $nextPoster,
                'deskripsi'     => $nextDesc,
                'id'            => (int) $existing['id'],
            ]);

            $fetch = $pdo->prepare(
                'SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
                 FROM events WHERE id = :id LIMIT 1'
            );
            $fetch->execute(['id' => (int) $existing['id']]);
            $updated = $fetch->fetch();
            $pdo->commit();

            if ($uploadedPath !== '' && str_starts_with((string) ($existing['poster_url'] ?? ''), 'uploads/')) {
                FileUploader::removePublicFile((string) $existing['poster_url']);
            }

            Response::ok(200, self::mapEventRow($updated), 'Detail event berhasil diperbarui.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($uploadedPath !== '') {
                FileUploader::removePublicFile($uploadedPath);
            }
            Response::error(500, 'Gagal memperbarui event di database.');
        }
    }

    public static function toggleStatus(PDO $pdo, string $eventCode): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();
        $nextStatus = strtolower(Validator::cleanString($input['status'] ?? ''));
        if (!in_array($nextStatus, ['active', 'cancelled', 'completed'], true)) {
            Response::error(422, 'Status event harus active, cancelled, atau completed.');
        }

        $stmt = $pdo->prepare(
            'UPDATE events
             SET status = :status
             WHERE kode_event = :code AND is_active = 1'
        );
        $stmt->execute([
            'status' => $nextStatus,
            'code'   => $eventCode,
        ]);

        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare('SELECT kode_event FROM events WHERE kode_event = :code AND is_active = 1 LIMIT 1');
            $check->execute(['code' => $eventCode]);
            if (!$check->fetch()) {
                Response::error(404, 'Event tidak ditemukan.');
            }
        }

        $fetch = $pdo->prepare(
            'SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
             FROM events WHERE kode_event = :code LIMIT 1'
        );
        $fetch->execute(['code' => $eventCode]);
        $row = $fetch->fetch();
        Response::ok(200, self::mapEventRow($row), 'Status event diperbarui.');
    }

    /**
     * Soft Delete: marks event inactive without breaking transaction foreign-key history.
     */
    public static function softDelete(PDO $pdo, string $eventCode): never
    {
        Auth::requireAdmin();
        $stmt = $pdo->prepare(
            "UPDATE events
             SET is_active = 0, status = 'cancelled'
             WHERE kode_event = :code AND is_active = 1"
        );
        $stmt->execute(['code' => $eventCode]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'Event tidak ditemukan atau sudah diarsipkan.');
        }

        Response::ok(200, ['id' => $eventCode, 'is_active' => 0], 'Event diarsipkan (Soft Delete).');
    }
}

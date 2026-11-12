<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class TransactionController
{
    public static function mapRow(array $r): array
    {
        return [
            'id'          => (string) $r['kode_transaksi'],
            'eventId'     => (string) $r['kode_event'],
            'eventTitle'  => (string) $r['event_title'],
            'buyerName'   => (string) $r['buyer_name'],
            'buyerEmail'  => (string) $r['buyer_email'],
            'buyerPhone'  => (string) $r['no_wa'],
            'qty'         => (int) $r['jumlah_tiket'],
            'unitPrice'   => (int) round((float) $r['unit_price']),
            'totalAmount' => (int) round((float) $r['total_harga']),
            'proofUrl'    => (string) ($r['bukti_bayar_url'] ?? ''),
            'proofName'   => (string) ($r['bukti_nama_asli'] ?? ''),
            'status'      => (string) $r['status'],
            'adminNote'   => (string) ($r['catatan_admin'] ?? ''),
            'createdAt'   => (string) $r['created_at'],
        ];
    }

    public static function list(PDO $pdo): never
    {
        Auth::requireAdmin();
        $rawStatus = strtolower(Validator::cleanString($_GET['status'] ?? 'all'));
        $status = match ($rawStatus) {
            'rejected' => 'cancelled',
            default    => $rawStatus,
        };

        $whereSql = '';
        $params = [];
        if (in_array($status, ['pending', 'paid', 'cancelled'], true)) {
            $whereSql = ' WHERE t.status = :status';
            $params['status'] = $status;
        }

        $paged = Paginator::fetchPaginated(
            $pdo,
            "SELECT COUNT(*) FROM transaksi_tiket t INNER JOIN users u ON u.id = t.user_id INNER JOIN events e ON e.id = t.event_id{$whereSql}",
            "SELECT t.kode_transaksi, e.kode_event, e.nama AS event_title, e.harga AS unit_price,
                    u.nama AS buyer_name, u.email AS buyer_email, t.no_wa,
                    t.jumlah_tiket, t.total_harga, t.bukti_bayar_url, t.bukti_nama_asli, t.status, t.catatan_admin, t.created_at
             FROM transaksi_tiket t
             INNER JOIN users u ON u.id = t.user_id
             INNER JOIN events e ON e.id = t.event_id{$whereSql}
             ORDER BY t.id DESC",
            $params,
            self::mapRow(...)
        );

        Response::ok(200, $paged);
    }

    public static function show(PDO $pdo, string $trxCode): never
    {
        Auth::requireAdmin();
        $stmt = $pdo->prepare(
            'SELECT t.kode_transaksi, e.kode_event, e.nama AS event_title, e.harga AS unit_price,
                    u.nama AS buyer_name, u.email AS buyer_email, t.no_wa,
                    t.jumlah_tiket, t.total_harga, t.bukti_bayar_url, t.bukti_nama_asli, t.status, t.catatan_admin, t.created_at
             FROM transaksi_tiket t
             INNER JOIN users u ON u.id = t.user_id
             INNER JOIN events e ON e.id = t.event_id
             WHERE t.kode_transaksi = :trx_code
             LIMIT 1'
        );
        $stmt->execute(['trx_code' => $trxCode]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error(404, 'Transaksi tidak ditemukan.');
        }

        Response::ok(200, self::mapRow($row));
    }

    public static function lookup(PDO $pdo): never
    {
        $query = Validator::cleanString($_GET['query'] ?? '');
        if ($query === '') {
            Response::error(422, 'Masukkan kode transaksi atau email pemesan.', [
                'query' => 'Kolom pencarian wajib diisi.',
            ]);
        }

        $params = [
            'trx_code'    => strtoupper($query),
            'buyer_email' => $query,
        ];

        $paged = Paginator::fetchPaginated(
            $pdo,
            'SELECT COUNT(*)
             FROM transaksi_tiket t
             INNER JOIN users u ON u.id = t.user_id
             INNER JOIN events e ON e.id = t.event_id
             WHERE t.kode_transaksi = :trx_code OR LOWER(u.email) = LOWER(:buyer_email)',
            'SELECT t.kode_transaksi, e.kode_event, e.nama AS event_title, e.harga AS unit_price,
                    u.nama AS buyer_name, u.email AS buyer_email, t.no_wa,
                    t.jumlah_tiket, t.total_harga, t.bukti_bayar_url, t.bukti_nama_asli, t.status, t.catatan_admin, t.created_at
             FROM transaksi_tiket t
             INNER JOIN users u ON u.id = t.user_id
             INNER JOIN events e ON e.id = t.event_id
             WHERE t.kode_transaksi = :trx_code OR LOWER(u.email) = LOWER(:buyer_email)
             ORDER BY t.id DESC',
            $params,
            self::mapRow(...),
            25
        );

        Response::ok(200, $paged);
    }

    public static function create(PDO $pdo): never
    {
        $input = $_POST !== [] ? $_POST : Response::readInput();

        $eventCode = Validator::cleanString($input['eventId'] ?? '');
        $buyerName = Validator::cleanString($input['buyerName'] ?? '');
        $buyerEmail = strtolower(Validator::cleanString($input['buyerEmail'] ?? ''));
        $buyerPhone = Validator::cleanString($input['buyerPhone'] ?? '');
        $qty = filter_var($input['qty'] ?? null, FILTER_VALIDATE_INT);

        $errors = [];
        if ($eventCode === '') {
            $errors['eventId'] = 'Event belum dipilih.';
        }
        if (mb_strlen($buyerName) < 2) {
            $errors['buyerName'] = 'Nama lengkap minimal 2 karakter.';
        }
        if (!Validator::isEmail($buyerEmail)) {
            $errors['buyerEmail'] = 'Format email tidak valid (contoh: nama@domain.com).';
        }
        if (!Validator::isPhone($buyerPhone)) {
            $errors['buyerPhone'] = 'Nomor WhatsApp harus 9 hingga 18 digit angka.';
        }
        if ($qty === false || $qty < 1 || $qty > 10) {
            $errors['qty'] = 'Jumlah tiket harus antara 1 hingga 10 per transaksi.';
        }

        $upload = FileUploader::handleUpload('proofFile', 'proofs', true);
        if (!$upload['ok']) {
            $errors['proofFile'] = $upload['error'] ?? 'Bukti transfer wajib diunggah.';
        }

        if ($errors !== []) {
            if (!empty($upload['path'])) {
                FileUploader::removePublicFile($upload['path']);
            }
            Response::error(422, 'Validasi transaksi ditolak (HTTP 422). Periksa kolom yang bermasalah.', $errors);
        }

        $proofPath = (string) $upload['path'];
        $proofOriginalName = (string) ($upload['originalName'] ?? 'bukti-transfer');

        $pdo->beginTransaction();
        try {
            // Lock target event row inside InnoDB transaction to prevent race-condition overbooking
            $evtStmt = $pdo->prepare(
                'SELECT id, kode_event, nama, harga, sisa_kuota, status, is_active
                 FROM events
                 WHERE kode_event = :kode_event AND is_active = 1
                 FOR UPDATE'
            );
            $evtStmt->execute(['kode_event' => $eventCode]);
            $event = $evtStmt->fetch();

            if (!$event || (string) $event['status'] !== 'active') {
                $pdo->rollBack();
                FileUploader::removePublicFile($proofPath);
                Response::error(422, 'Validasi transaksi ditolak (HTTP 422).', [
                    'eventId' => 'Event tidak tersedia atau sudah dibatalkan.',
                ]);
            }

            if ((int) $event['sisa_kuota'] < (int) $qty) {
                $pdo->rollBack();
                FileUploader::removePublicFile($proofPath);
                Response::error(422, 'Validasi transaksi ditolak (HTTP 422).', [
                    'qty' => 'Jumlah melebihi sisa kuota event (' . (int) $event['sisa_kuota'] . ' tiket tersisa).',
                ]);
            }

            $deductStmt = $pdo->prepare(
                'UPDATE events
                 SET sisa_kuota = sisa_kuota - :qty
                 WHERE id = :id AND sisa_kuota >= :qty_check'
            );
            $deductStmt->execute([
                'qty'       => (int) $qty,
                'id'        => (int) $event['id'],
                'qty_check' => (int) $qty,
            ]);

            if ($deductStmt->rowCount() !== 1) {
                $pdo->rollBack();
                FileUploader::removePublicFile($proofPath);
                Response::error(422, 'Kuota tiket tidak mencukupi pada saat bersamaan.', [
                    'qty' => 'Silakan periksa kembali sisa kuota yang tersedia.',
                ]);
            }

            // Resolve or register user account cleanly (1:N users -> transaksi_tiket)
            $userStmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1 FOR UPDATE');
            $userStmt->execute(['email' => $buyerEmail]);
            $userId = $userStmt->fetchColumn();

            if ($userId === false) {
                $insUser = $pdo->prepare(
                    "INSERT INTO users (nama, email, password_hash, role, is_active)
                     VALUES (:nama, :email, :password_hash, 'user', 1)"
                );
                $insUser->execute([
                    'nama'          => mb_substr($buyerName, 0, 100),
                    'email'         => $buyerEmail,
                    'password_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT),
                ]);
                $userId = (int) $pdo->lastInsertId();
            } else {
                $userId = (int) $userId;
            }

            $maxStmt = $pdo->prepare('SELECT COALESCE(MAX(id), 0) FROM transaksi_tiket FOR UPDATE');
            $maxStmt->execute();
            $nextSeq = ((int) $maxStmt->fetchColumn()) + 1;
            $trxCode = sprintf('TRX-2026-%04d', $nextSeq);

            $unitPrice = (float) $event['harga'];
            $totalHarga = number_format($unitPrice * (int) $qty, 2, '.', '');

            $ins = $pdo->prepare(
                'INSERT INTO transaksi_tiket (kode_transaksi, user_id, event_id, no_wa, jumlah_tiket, total_harga, bukti_bayar_url, bukti_nama_asli, status, catatan_admin)
                 VALUES (:kode_transaksi, :user_id, :event_id, :no_wa, :jumlah_tiket, :total_harga, :bukti_bayar_url, :bukti_nama_asli, :status, :catatan_admin)'
            );
            $ins->execute([
                'kode_transaksi'  => $trxCode,
                'user_id'         => $userId,
                'event_id'        => (int) $event['id'],
                'no_wa'           => $buyerPhone,
                'jumlah_tiket'    => (int) $qty,
                'total_harga'     => $totalHarga,
                'bukti_bayar_url' => $proofPath,
                'bukti_nama_asli' => $proofOriginalName,
                'status'          => 'pending',
                'catatan_admin'   => '',
            ]);

            $fetch = $pdo->prepare(
                'SELECT t.kode_transaksi, e.kode_event, e.nama AS event_title, e.harga AS unit_price,
                        u.nama AS buyer_name, u.email AS buyer_email, t.no_wa,
                        t.jumlah_tiket, t.total_harga, t.bukti_bayar_url, t.bukti_nama_asli, t.status, t.catatan_admin, t.created_at
                 FROM transaksi_tiket t
                 INNER JOIN users u ON u.id = t.user_id
                 INNER JOIN events e ON e.id = t.event_id
                 WHERE t.kode_transaksi = :trx_code
                 LIMIT 1'
            );
            $fetch->execute(['trx_code' => $trxCode]);
            $created = $fetch->fetch();

            $pdo->commit();
            Response::ok(201, self::mapRow($created), 'Tiket berhasil dipesan dengan status pending verifikasi.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            FileUploader::removePublicFile($proofPath);
            Response::error(500, 'Terjadi kesalahan server saat memproses transaksi.');
        }
    }

    public static function verify(PDO $pdo, string $trxCode): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();
        $rawDecision = strtolower(Validator::cleanString($input['decision'] ?? ''));
        $decision = match ($rawDecision) {
            'paid'     => 'paid',
            'rejected',
            'cancelled' => 'cancelled',
            default    => '',
        };
        $adminNote = Validator::cleanString($input['adminNote'] ?? '');

        if ($decision === '') {
            Response::error(422, 'Keputusan verifikasi tidak valid.', [
                'decision' => 'Pilih Terima (paid) atau Tolak / Batalkan (cancelled).',
            ]);
        }

        $pdo->beginTransaction();
        try {
            $trxStmt = $pdo->prepare(
                'SELECT id, kode_transaksi, event_id, jumlah_tiket, status
                 FROM transaksi_tiket
                 WHERE kode_transaksi = :trx_code
                 FOR UPDATE'
            );
            $trxStmt->execute(['trx_code' => $trxCode]);
            $trx = $trxStmt->fetch();

            if (!$trx) {
                $pdo->rollBack();
                Response::error(404, 'Transaksi tidak ditemukan.');
            }

            $evtStmt = $pdo->prepare(
                'SELECT id, kapasitas, sisa_kuota
                 FROM events
                 WHERE id = :event_id
                 FOR UPDATE'
            );
            $evtStmt->execute(['event_id' => (int) $trx['event_id']]);
            $evt = $evtStmt->fetch();

            $prevStatus = (string) $trx['status'];
            $qty = (int) $trx['jumlah_tiket'];

            if ($evt) {
                if ($prevStatus !== 'cancelled' && $decision === 'cancelled') {
                    $restore = $pdo->prepare(
                        'UPDATE events
                         SET sisa_kuota = LEAST(kapasitas, sisa_kuota + :qty)
                         WHERE id = :id'
                    );
                    $restore->execute(['qty' => $qty, 'id' => (int) $evt['id']]);
                } elseif ($prevStatus === 'cancelled' && $decision === 'paid') {
                    if ((int) $evt['sisa_kuota'] < $qty) {
                        $pdo->rollBack();
                        Response::error(422, 'Sisa kuota event tidak mencukupi untuk mengaktifkan kembali transaksi ini.');
                    }
                    $reDeduct = $pdo->prepare(
                        'UPDATE events
                         SET sisa_kuota = sisa_kuota - :qty
                         WHERE id = :id AND sisa_kuota >= :qty_check'
                    );
                    $reDeduct->execute(['qty' => $qty, 'id' => (int) $evt['id'], 'qty_check' => $qty]);
                }
            }

            $upd = $pdo->prepare(
                'UPDATE transaksi_tiket
                 SET status = :status, catatan_admin = :catatan_admin
                 WHERE id = :id'
            );
            $upd->execute([
                'status'        => $decision,
                'catatan_admin' => $adminNote,
                'id'            => (int) $trx['id'],
            ]);

            $fetch = $pdo->prepare(
                'SELECT t.kode_transaksi, e.kode_event, e.nama AS event_title, e.harga AS unit_price,
                        u.nama AS buyer_name, u.email AS buyer_email, t.no_wa,
                        t.jumlah_tiket, t.total_harga, t.bukti_bayar_url, t.bukti_nama_asli, t.status, t.catatan_admin, t.created_at
                 FROM transaksi_tiket t
                 INNER JOIN users u ON u.id = t.user_id
                 INNER JOIN events e ON e.id = t.event_id
                 WHERE t.id = :id
                 LIMIT 1'
            );
            $fetch->execute(['id' => (int) $trx['id']]);
            $updated = $fetch->fetch();

            $pdo->commit();
            $msg = $decision === 'paid'
                ? 'Pembayaran disetujui (paid).'
                : 'Pembayaran dibatalkan dan kuota dikembalikan.';
            Response::ok(200, self::mapRow($updated), $msg);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error(500, 'Gagal memproses verifikasi transaksi.');
        }
    }
}

<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class BandController
{
    public static function mapRow(array $r): array
    {
        return [
            'id'         => (string) $r['kode_band'],
            'bandName'   => (string) $r['nama_band'],
            'genre'      => (string) $r['genre'],
            'originCity' => (string) $r['asal_kota'],
            'contact'    => (string) $r['kontak_wa'],
            'demoUrl'    => (string) $r['link_demo'],
            'bio'        => (string) ($r['bio'] ?? ''),
            'status'     => (string) $r['status'],
            'createdAt'  => (string) $r['created_at'],
        ];
    }

    public static function list(PDO $pdo): never
    {
        Auth::requireAdmin();
        $rawStatus = strtolower(Validator::cleanString($_GET['status'] ?? 'all'));
        $status = $rawStatus === 'approved' ? 'accepted' : $rawStatus;

        $whereSql = 'WHERE is_active = 1';
        $params = [];
        if (in_array($status, ['pending', 'reviewed', 'accepted', 'rejected'], true)) {
            $whereSql .= ' AND status = :status';
            $params['status'] = $status;
        }

        $paged = Paginator::fetchPaginated(
            $pdo,
            "SELECT COUNT(*) FROM pendaftaran_band {$whereSql}",
            "SELECT kode_band, nama_band, genre, asal_kota, kontak_wa, link_demo, bio, status, created_at
             FROM pendaftaran_band
             {$whereSql}
             ORDER BY id DESC",
            $params,
            self::mapRow(...)
        );

        Response::ok(200, $paged);
    }

    public static function show(PDO $pdo, string $bandCode): never
    {
        Auth::requireAdmin();
        $stmt = $pdo->prepare(
            'SELECT kode_band, nama_band, genre, asal_kota, kontak_wa, link_demo, bio, status, created_at
             FROM pendaftaran_band
             WHERE kode_band = :code AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['code' => $bandCode]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error(404, 'Data band tidak ditemukan.');
        }

        Response::ok(200, self::mapRow($row));
    }

    public static function create(PDO $pdo): never
    {
        $input = Response::readInput();
        $bandName = Validator::cleanString($input['bandName'] ?? '');
        $genre = Validator::cleanString($input['genre'] ?? '');
        $originCity = Validator::cleanString($input['originCity'] ?? '');
        $contact = Validator::cleanString($input['contact'] ?? '');
        $demoUrl = Validator::cleanString($input['demoUrl'] ?? '');
        $bio = Validator::cleanString($input['bio'] ?? '');

        $errors = [];
        if (mb_strlen($bandName) < 2) {
            $errors['bandName'] = 'Nama band minimal 2 karakter.';
        }
        if (mb_strlen($genre) < 2) {
            $errors['genre'] = 'Pilih atau isi genre musik band.';
        }
        if (mb_strlen($originCity) < 2) {
            $errors['originCity'] = 'Kota asal band wajib diisi.';
        }
        if (mb_strlen($contact) < 6 || mb_strlen($contact) > 20) {
            $errors['contact'] = 'Nomor WhatsApp band wajib diisi (6 hingga 20 karakter).';
        }
        if (!Validator::isHttpUrl($demoUrl)) {
            $errors['demoUrl'] = 'Link demo lagu harus berupa URL valid berawalan https:// atau http://.';
        }

        if ($errors !== []) {
            Response::error(422, 'Pendaftaran band ditolak (HTTP 422). Periksa kembali data band.', $errors);
        }

        $bioFinal = $bio !== '' ? $bio : 'Pendaftar audisi Tarakota Fest 2026.';

        $pdo->beginTransaction();
        try {
            $maxStmt = $pdo->prepare('SELECT COALESCE(MAX(id), 0) FROM pendaftaran_band FOR UPDATE');
            $maxStmt->execute();
            $nextSeq = ((int) $maxStmt->fetchColumn()) + 1;
            $bandCode = sprintf('BND-%03d', $nextSeq);

            $ins = $pdo->prepare(
                'INSERT INTO pendaftaran_band (kode_band, nama_band, genre, asal_kota, kontak_wa, link_demo, bio, status, is_active)
                 VALUES (:kode_band, :nama_band, :genre, :asal_kota, :kontak_wa, :link_demo, :bio, :status, 1)'
            );
            $ins->execute([
                'kode_band' => $bandCode,
                'nama_band' => $bandName,
                'genre'     => $genre,
                'asal_kota' => $originCity,
                'kontak_wa' => mb_substr($contact, 0, 20),
                'link_demo' => $demoUrl,
                'bio'       => $bioFinal,
                'status'    => 'pending',
            ]);

            $fetch = $pdo->prepare(
                'SELECT kode_band, nama_band, genre, asal_kota, kontak_wa, link_demo, bio, status, created_at
                 FROM pendaftaran_band WHERE kode_band = :code LIMIT 1'
            );
            $fetch->execute(['code' => $bandCode]);
            $created = $fetch->fetch();
            $pdo->commit();

            Response::ok(201, self::mapRow($created), 'Profil band berhasil dikirim untuk kurasi.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error(500, 'Gagal menyimpan data pendaftaran band.');
        }
    }

    public static function curate(PDO $pdo, string $bandCode): never
    {
        Auth::requireAdmin();
        $input = Response::readInput();
        $rawDecision = strtolower(Validator::cleanString($input['decision'] ?? ''));
        $decision = match ($rawDecision) {
            'approved',
            'accepted' => 'accepted',
            'reviewed' => 'reviewed',
            'rejected' => 'rejected',
            default    => '',
        };
        $slot = is_array($input['scheduleSlot'] ?? null) ? $input['scheduleSlot'] : [];

        if ($decision === '') {
            Response::error(422, 'Status kurasi harus reviewed, accepted, atau rejected.');
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'SELECT id, kode_band, nama_band, genre, asal_kota
                 FROM pendaftaran_band
                 WHERE kode_band = :code AND is_active = 1
                 FOR UPDATE'
            );
            $stmt->execute(['code' => $bandCode]);
            $band = $stmt->fetch();

            if (!$band) {
                $pdo->rollBack();
                Response::error(404, 'Data band tidak ditemukan.');
            }

            $upd = $pdo->prepare(
                'UPDATE pendaftaran_band
                 SET status = :status
                 WHERE id = :id'
            );
            $upd->execute([
                'status' => $decision,
                'id'     => (int) $band['id'],
            ]);

            if ($decision === 'accepted' && !empty($slot['publishToSchedule'])) {
                $existsStmt = $pdo->prepare(
                    'SELECT id FROM jadwal_panggung WHERE LOWER(nama_artis) = LOWER(:artist) AND is_active = 1 LIMIT 1'
                );
                $existsStmt->execute(['artist' => (string) $band['nama_band']]);

                if (!$existsStmt->fetch()) {
                    $maxSch = $pdo->prepare('SELECT COALESCE(MAX(id), 0) FROM jadwal_panggung FOR UPDATE');
                    $maxSch->execute();
                    $nextSch = ((int) $maxSch->fetchColumn()) + 1;
                    $schCode = sprintf('SCH-%02d', $nextSch);

                    $insSch = $pdo->prepare(
                        'INSERT INTO jadwal_panggung (kode_jadwal, band_id, nama_artis, hari_festival, stage, genre, jam_tampil, asal_kota, is_active)
                         VALUES (:kode_jadwal, :band_id, :nama_artis, :hari_festival, :stage, :genre, :jam_tampil, :asal_kota, 1)'
                    );
                    $insSch->execute([
                        'kode_jadwal'   => $schCode,
                        'band_id'       => (int) $band['id'],
                        'nama_artis'    => (string) $band['nama_band'],
                        'hari_festival' => Validator::cleanString($slot['day'] ?? 'Hari 1 (Jumat, 14 Agu)'),
                        'stage'         => Validator::cleanString($slot['stage'] ?? 'Karang Acoustic Deck'),
                        'genre'         => (string) $band['genre'],
                        'jam_tampil'    => Validator::cleanString($slot['timeRange'] ?? '16:00 - 16:45 WITA'),
                        'asal_kota'     => (string) $band['asal_kota'],
                    ]);
                }
            }

            $fetch = $pdo->prepare(
                'SELECT kode_band, nama_band, genre, asal_kota, kontak_wa, link_demo, bio, status, created_at
                 FROM pendaftaran_band WHERE id = :id LIMIT 1'
            );
            $fetch->execute(['id' => (int) $band['id']]);
            $updated = $fetch->fetch();
            $pdo->commit();

            Response::ok(200, self::mapRow($updated), 'Status kurasi band diperbarui.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Response::error(500, 'Gagal memproses kurasi band.');
        }
    }
}

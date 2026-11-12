<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class ScheduleController
{
    public static function mapRow(array $r): array
    {
        return [
            'id'         => (string) $r['kode_jadwal'],
            'artistName' => (string) $r['nama_artis'],
            'day'        => (string) $r['hari_festival'],
            'stage'      => (string) $r['stage'],
            'genre'      => (string) $r['genre'],
            'timeRange'  => (string) $r['jam_tampil'],
            'originCity' => (string) $r['asal_kota'],
        ];
    }

    public static function list(PDO $pdo): never
    {
        $day = Validator::cleanString($_GET['day'] ?? 'ALL');
        $stage = Validator::cleanString($_GET['stage'] ?? 'ALL');
        $genre = Validator::cleanString($_GET['genre'] ?? 'ALL');
        $search = Validator::cleanString($_GET['search'] ?? '');

        $where = ['is_active = 1'];
        $params = [];

        if ($day !== '' && $day !== 'ALL') {
            $where[] = 'hari_festival = :day';
            $params['day'] = $day;
        }
        if ($stage !== '' && $stage !== 'ALL') {
            $where[] = 'stage = :stage';
            $params['stage'] = $stage;
        }
        if ($genre !== '' && $genre !== 'ALL') {
            $where[] = 'genre = :genre';
            $params['genre'] = $genre;
        }
        if ($search !== '') {
            $where[] = '(nama_artis LIKE :search_artist OR asal_kota LIKE :search_city OR genre LIKE :search_genre)';
            $like = '%' . $search . '%';
            $params['search_artist'] = $like;
            $params['search_city'] = $like;
            $params['search_genre'] = $like;
        }

        $whereSql = implode(' AND ', $where);
        $paged = Paginator::fetchPaginated(
            $pdo,
            "SELECT COUNT(*) FROM jadwal_panggung WHERE {$whereSql}",
            "SELECT kode_jadwal, nama_artis, hari_festival, stage, genre, jam_tampil, asal_kota
             FROM jadwal_panggung
             WHERE {$whereSql}
             ORDER BY id ASC",
            $params,
            self::mapRow(...)
        );

        $daysStmt = $pdo->prepare('SELECT DISTINCT hari_festival FROM jadwal_panggung WHERE is_active = 1 ORDER BY hari_festival ASC');
        $daysStmt->execute();
        $stagesStmt = $pdo->prepare('SELECT DISTINCT stage FROM jadwal_panggung WHERE is_active = 1 ORDER BY stage ASC');
        $stagesStmt->execute();
        $genresStmt = $pdo->prepare('SELECT DISTINCT genre FROM jadwal_panggung WHERE is_active = 1 ORDER BY genre ASC');
        $genresStmt->execute();

        $paged['options'] = [
            'days'   => $daysStmt->fetchAll(PDO::FETCH_COLUMN),
            'stages' => $stagesStmt->fetchAll(PDO::FETCH_COLUMN),
            'genres' => $genresStmt->fetchAll(PDO::FETCH_COLUMN),
        ];

        Response::ok(200, $paged);
    }
}

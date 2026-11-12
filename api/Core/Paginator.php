<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class Paginator
{
    public const MAX_LIMIT = 100;

    /**
     * Reads sanitized page/limit/offset query parameters for SQL LIMIT/OFFSET clauses.
     *
     * @return array{page: int, limit: int, offset: int}
     */
    public static function readParams(int $defaultLimit = 50): array
    {
        $rawPage = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
        $rawLimit = filter_var($_GET['limit'] ?? $defaultLimit, FILTER_VALIDATE_INT);

        $page = ($rawPage !== false && $rawPage > 0) ? (int) $rawPage : 1;
        $limit = ($rawLimit !== false && $rawLimit > 0)
            ? min((int) $rawLimit, self::MAX_LIMIT)
            : min(max($defaultLimit, 1), self::MAX_LIMIT);

        return [
            'page'   => $page,
            'limit'  => $limit,
            'offset' => ($page - 1) * $limit,
        ];
    }

    /**
     * Executes a COUNT(*) query and a prepared SELECT ... LIMIT :_limit OFFSET :_offset query.
     *
     * @param array<string, int|string> $params
     * @return array{
     *   items: list<array<string, mixed>>,
     *   pagination: array{page: int, limit: int, total: int, totalPages: int}
     * }
     */
    public static function fetchPaginated(
        PDO $pdo,
        string $countSql,
        string $dataSql,
        array $params,
        callable $mapper,
        int $defaultLimit = 50
    ): array {
        if (array_key_exists('page', $_GET)) {
            $rawPage = filter_var($_GET['page'], FILTER_VALIDATE_INT);
            if ($rawPage === false || $rawPage < 1) {
                Response::error(400, 'Parameter pagination tidak valid.', [
                    'page' => 'Nilai page harus berupa bilangan bulat minimal 1.',
                ]);
            }
        }
        if (array_key_exists('limit', $_GET)) {
            $rawLimit = filter_var($_GET['limit'], FILTER_VALIDATE_INT);
            if ($rawLimit === false || $rawLimit < 1) {
                Response::error(400, 'Parameter pagination tidak valid.', [
                    'limit' => 'Nilai limit harus berupa bilangan bulat minimal 1.',
                ]);
            }
        }

        $paging = self::readParams($defaultLimit);

        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $countStmt->bindValue(':' . $key, $value, $paramType);
        }
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        $totalPages = max(1, (int) ceil($total / $paging['limit']));
        $page = min($paging['page'], $totalPages);
        $offset = ($page - 1) * $paging['limit'];

        $dataStmt = $pdo->prepare($dataSql . ' LIMIT :_limit OFFSET :_offset');
        foreach ($params as $key => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $dataStmt->bindValue(':' . $key, $value, $paramType);
        }
        $dataStmt->bindValue(':_limit', $paging['limit'], PDO::PARAM_INT);
        $dataStmt->bindValue(':_offset', $offset, PDO::PARAM_INT);
        $dataStmt->execute();

        $items = array_map($mapper, $dataStmt->fetchAll());

        return [
            'items'      => $items,
            'pagination' => [
                'page'       => $page,
                'limit'      => $paging['limit'],
                'total'      => $total,
                'totalPages' => $totalPages,
            ],
        ];
    }
}


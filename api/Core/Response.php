<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class Response
{
    public static function json(int $statusCode, array $payload): never
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function ok(int $statusCode, mixed $data, string $message = ''): never
    {
        self::json($statusCode, [
            'ok'      => true,
            'status'  => $statusCode,
            'message' => $message,
            'data'    => $data,
        ]);
    }

    public static function error(int $statusCode, string $message, array $errors = []): never
    {
        self::json($statusCode, [
            'ok'      => false,
            'status'  => $statusCode,
            'message' => $message,
            'errors'  => $errors,
        ]);
    }

    /**
     * Reads JSON body when Content-Type is application/json, falling back to $_POST.
     */
    public static function readInput(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') !== false) {
            $raw = file_get_contents('php://input');
            if ($raw === false || trim($raw) === '') {
                return [];
            }
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        return $_POST;
    }
}


<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class Validator
{
    public static function cleanString(mixed $value): string
    {
        return trim((string) ($value ?? ''));
    }

    public static function isEmail(string $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function isPhone(string $value): bool
    {
        return preg_match('/^[0-9+\-\s]{9,18}$/', $value) === 1;
    }

    public static function isHttpUrl(string $value): bool
    {
        if (filter_var($value, FILTER_VALIDATE_URL) === false) {
            return false;
        }
        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        return $scheme === 'http' || $scheme === 'https';
    }
}


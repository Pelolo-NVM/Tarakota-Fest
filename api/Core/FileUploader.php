<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class FileUploader
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    private const ALLOWED_MIME_MAP = [
        'image/png'  => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
    ];

    /**
     * Validates and moves an uploaded multipart/form-data file into uploads/<subDir>.
     *
     * @return array{ok: bool, path?: string, originalName?: string, error?: string}
     */
    public static function handleUpload(string $fieldName, string $subDir, bool $required = true): array
    {
        if (!isset($_FILES[$fieldName]) || !is_array($_FILES[$fieldName])) {
            return $required
                ? ['ok' => false, 'error' => 'Berkas unggahan wajib dipilih.']
                : ['ok' => true];
        }

        $file = $_FILES[$fieldName];
        $errCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($errCode === UPLOAD_ERR_NO_FILE) {
            return $required
                ? ['ok' => false, 'error' => 'Berkas unggahan wajib dipilih.']
                : ['ok' => true];
        }

        if ($errCode !== UPLOAD_ERR_OK) {
            return ['ok' => false, 'error' => 'Terjadi kegagalan unggah berkas (kode ' . $errCode . ').'];
        }

        $tmpPath = (string) ($file['tmp_name'] ?? '');
        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            return ['ok' => false, 'error' => 'Sumber unggahan berkas tidak valid.'];
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > self::MAX_BYTES) {
            return ['ok' => false, 'error' => 'Ukuran file maksimal 2 MB.'];
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo !== false ? (string) finfo_file($finfo, $tmpPath) : '';
        if ($finfo !== false) {
            finfo_close($finfo);
        }

        if (!isset(self::ALLOWED_MIME_MAP[$mime])) {
            return ['ok' => false, 'error' => 'Format file harus PNG, JPG, atau WEBP yang valid.'];
        }

        $safeSubDir = preg_replace('/[^a-zA-Z0-9_-]/', '', $subDir);
        $targetDir = TARAKOTA_ROOT_DIR . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $safeSubDir;
        if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
            return ['ok' => false, 'error' => 'Direktori penyimpanan lokal gagal disiapkan.'];
        }

        $ext = self::ALLOWED_MIME_MAP[$mime];
        $generatedName = date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $destPath = $targetDir . DIRECTORY_SEPARATOR . $generatedName;

        if (!move_uploaded_file($tmpPath, $destPath)) {
            return ['ok' => false, 'error' => 'Gagal menyimpan file ke direktori lokal.'];
        }

        return [
            'ok'           => true,
            'path'         => 'uploads/' . $safeSubDir . '/' . $generatedName,
            'originalName' => basename((string) ($file['name'] ?? $generatedName)),
        ];
    }

    public static function removePublicFile(string $relativePath): void
    {
        if (!str_starts_with($relativePath, 'uploads/')) {
            return;
        }
        $fullPath = TARAKOTA_ROOT_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }
}


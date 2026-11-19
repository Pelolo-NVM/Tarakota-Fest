<?php
declare(strict_types=1);

/**
 * Tarakota Fest 2026 - JSON REST API Single Entry Point
 * Strictly returns application/json; never renders HTML views.
 */

define('TARAKOTA_APP', true);
define('TARAKOTA_ROOT_DIR', dirname(__DIR__));
define('TARAKOTA_API_DIR', __DIR__);

ini_set('display_errors', '0');

require_once TARAKOTA_ROOT_DIR . '/config/database.php';
require_once TARAKOTA_API_DIR . '/Core/Response.php';
require_once TARAKOTA_API_DIR . '/Core/Validator.php';
require_once TARAKOTA_API_DIR . '/Core/Auth.php';
require_once TARAKOTA_API_DIR . '/Core/FileUploader.php';
require_once TARAKOTA_API_DIR . '/Core/Paginator.php';
require_once TARAKOTA_API_DIR . '/Controllers/AuthController.php';
require_once TARAKOTA_API_DIR . '/Controllers/EventController.php';
require_once TARAKOTA_API_DIR . '/Controllers/ScheduleController.php';
require_once TARAKOTA_API_DIR . '/Controllers/TransactionController.php';
require_once TARAKOTA_API_DIR . '/Controllers/BandController.php';
require_once TARAKOTA_API_DIR . '/Controllers/AnalyticsController.php';
require_once TARAKOTA_API_DIR . '/Controllers/UserController.php';

Auth::startSession();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$rawPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'))), '/');

$route = $rawPath;
if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($route, $scriptDir)) {
    $route = substr($route, strlen($scriptDir));
} elseif (str_starts_with($route, '/api')) {
    $route = substr($route, 4);
}
if (str_starts_with($route, '/index.php')) {
    $route = substr($route, 10);
}
if ($route !== '/' && str_ends_with($route, '/')) {
    $route = rtrim($route, '/');
}
if ($route === '') {
    $route = '/';
}

try {
    if ($method === 'GET' && ($route === '/' || $route === '/health')) {
        $pdo = tarakota_db();
        $pdo->query('SELECT 1');
        Response::ok(200, [
            'service' => 'tarakota-fest-api',
            'status'  => 'healthy',
            'time'    => gmdate('c'),
        ]);
    }

    // Authentication & Profile endpoints (Modul 12: Register/Login/Logout & /api/me)
    if (($route === '/register' || $route === '/auth/register') && $method === 'POST') {
        AuthController::register(tarakota_db());
    }
    if (($route === '/login' || $route === '/auth/login') && $method === 'POST') {
        AuthController::login(tarakota_db(), false);
    }
    if (($route === '/logout' || $route === '/auth/logout' || $route === '/admin/logout') && $method === 'POST') {
        AuthController::logout();
    }
    if (($route === '/me' || $route === '/auth/me') && $method === 'GET') {
        AuthController::me(tarakota_db());
    }

    // Admin authentication endpoints (Legacy support)
    if ($route === '/admin/login' && $method === 'POST') {
        AuthController::login(tarakota_db(), true);
    }
    if ($route === '/admin/session' && $method === 'GET') {
        AuthController::session();
    }

    // Events CRUD endpoints
    if ($route === '/events' && $method === 'GET') {
        $includeAll = ((string) ($_GET['all'] ?? '0')) === '1';
        EventController::list(tarakota_db(), $includeAll);
    }
    if ($route === '/events' && $method === 'POST') {
        EventController::create(tarakota_db());
    }
    if (preg_match('#^/events/([A-Za-z0-9_-]+)$#', $route, $m)) {
        if ($method === 'GET') {
            EventController::show(tarakota_db(), $m[1]);
        }
        if ($method === 'PUT' || $method === 'PATCH' || $method === 'POST') {
            EventController::update(tarakota_db(), $m[1], $method === 'PATCH');
        }
        if ($method === 'DELETE') {
            EventController::softDelete(tarakota_db(), $m[1]);
        }
    }
    if (preg_match('#^/events/([A-Za-z0-9_-]+)/status$#', $route, $m) && $method === 'PATCH') {
        EventController::toggleStatus(tarakota_db(), $m[1]);
    }

    // Schedule endpoint
    if ($route === '/schedule' && $method === 'GET') {
        ScheduleController::list(tarakota_db());
    }

    // Ticket transactions endpoints
    if ($route === '/transactions' && $method === 'GET') {
        TransactionController::list(tarakota_db());
    }
    if ($route === '/my-tickets' && $method === 'GET') {
        TransactionController::myTickets(tarakota_db());
    }
    if ($route === '/transactions/lookup' && $method === 'GET') {
        TransactionController::lookup(tarakota_db());
    }
    if ($route === '/transactions' && $method === 'POST') {
        TransactionController::create(tarakota_db());
    }
    if (preg_match('#^/transactions/([A-Za-z0-9_-]+)$#', $route, $m) && $method === 'GET') {
        TransactionController::show(tarakota_db(), $m[1]);
    }
    if (preg_match('#^/transactions/([A-Za-z0-9_-]+)/proof$#', $route, $m) && $method === 'POST') {
        TransactionController::uploadProof(tarakota_db(), $m[1]);
    }
    if (preg_match('#^/transactions/([A-Za-z0-9_-]+)/verify$#', $route, $m) && $method === 'PATCH') {
        TransactionController::verify(tarakota_db(), $m[1]);
    }

    // Band registration & curation endpoints
    if ($route === '/bands' && $method === 'GET') {
        BandController::list(tarakota_db());
    }
    if ($route === '/bands' && $method === 'POST') {
        BandController::create(tarakota_db());
    }
    if (preg_match('#^/bands/([A-Za-z0-9_-]+)$#', $route, $m) && $method === 'GET') {
        BandController::show(tarakota_db(), $m[1]);
    }
    if (preg_match('#^/bands/([A-Za-z0-9_-]+)/curate$#', $route, $m) && $method === 'PATCH') {
        BandController::curate(tarakota_db(), $m[1]);
    }

    // Analytics summary endpoint
    if ($route === '/analytics/summary' && $method === 'GET') {
        AnalyticsController::summary(tarakota_db());
    }

    // User management endpoints (Admin Only)
    if ($route === '/users' && $method === 'GET') {
        UserController::list(tarakota_db());
    }
    if ($route === '/users' && $method === 'POST') {
        UserController::create(tarakota_db());
    }
    if (preg_match('#^/users/(\d+)/status$#', $route, $m) && $method === 'PATCH') {
        UserController::toggleStatus(tarakota_db(), (int) $m[1]);
    }

    Response::error(404, 'Endpoint API tidak ditemukan.');
} catch (PDOException $e) {
    error_log('[TarakotaPDO] ' . $e->getMessage());
    Response::error(500, 'Terjadi kesalahan pada database MySQL. Pastikan MySQL berjalan dan schema termigrasi.');
} catch (Throwable $e) {
    error_log('[TarakotaServer] ' . $e->getMessage());
    Response::error(500, 'Terjadi kesalahan internal server API.');
}

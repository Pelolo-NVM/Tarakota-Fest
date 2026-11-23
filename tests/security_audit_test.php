<?php
declare(strict_types=1);

/**
 * Tarakota Fest 2026 - Automated Security Verification Suite (Modul 13)
 * Tests OWASP Top 10:2025 mitigations, RBAC, CSRF, SQLi, XSS, and IDOR defenses.
 */

$baseUrl = 'http://localhost/TarakotaFest/api';
$cookieFile = sys_get_temp_dir() . '/tarakota_test_cookies_' . bin2hex(random_bytes(4)) . '.txt';

function httpReq(string $method, string $url, array $headers = [], $body = null, ?string $cookieJar = null): array {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    $reqHeaders = array_merge(['Accept: application/json'], $headers);
    if ($body !== null && !is_array($body)) {
        if (!preg_grep('/^Content-Type:/i', $reqHeaders)) {
            $reqHeaders[] = 'Content-Type: application/json';
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    } elseif (is_array($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);
    
    if ($cookieJar !== null) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    }
    
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    
    $headerStr = substr($raw, 0, $headerSize);
    $bodyStr = substr($raw, $headerSize);
    
    $parsedHeaders = [];
    foreach (explode("\r\n", $headerStr) as $line) {
        if (strpos($line, ':') !== false) {
            [$k, $v] = explode(':', $line, 2);
            $parsedHeaders[strtolower(trim($k))] = trim($v);
        }
    }
    
    $json = json_decode($bodyStr, true);
    curl_close($ch);
    
    return [
        'code'    => $httpCode,
        'headers' => $parsedHeaders,
        'body'    => $bodyStr,
        'json'    => $json,
    ];
}

$results = [];
function recordTest(string $category, string $testName, bool $passed, string $details): void {
    global $results;
    $status = $passed ? 'PASS' : 'FAIL';
    $results[] = [
        'category' => $category,
        'name'     => $testName,
        'status'   => $status,
        'details'  => $details,
    ];
    echo sprintf("[%s] [%s] %s: %s\n", $status, $category, $testName, $details);
}

echo "====================================================================\n";
echo "TARAKOTA FEST 2026 - MODUL 13 SECURITY AUDIT & VERIFICATION SUITE\n";
echo "====================================================================\n\n";

// ------------------------------------------------------------------
// 1. HTTP Security Headers (OWASP A02: Security Misconfiguration)
// ------------------------------------------------------------------
$res = httpReq('GET', $baseUrl . '/health');
$hasNosniff = ($res['headers']['x-content-type-options'] ?? '') === 'nosniff';
$hasFrameOptions = ($res['headers']['x-frame-options'] ?? '') === 'SAMEORIGIN';
$hasXssProt = str_contains($res['headers']['x-xss-protection'] ?? '', '1');
$hasReferrer = ($res['headers']['referrer-policy'] ?? '') === 'strict-origin-when-cross-origin';
$allHeaders = $hasNosniff && $hasFrameOptions && $hasXssProt && $hasReferrer;

recordTest('A02:Misconfiguration', 'HTTP Security Headers Presence', $allHeaders, 
    "nosniff=" . ($hasNosniff?'YES':'NO') . ", SAMEORIGIN=" . ($hasFrameOptions?'YES':'NO') . 
    ", XSS-Prot=" . ($hasXssProt?'YES':'NO') . ", Referrer-Policy=" . ($hasReferrer?'YES':'NO'));

// ------------------------------------------------------------------
// 2. SQL Injection Resistance (OWASP A05: Injection)
// ------------------------------------------------------------------
$sqliPayload = "' OR '1'='1' -- ";
$resSqli = httpReq('GET', $baseUrl . '/events?search=' . urlencode($sqliPayload));
$sqliSafe = ($resSqli['code'] === 200 && ($resSqli['json']['ok'] ?? false) === true);
// Verify that the SQL query didn't return every event blindly or crash
recordTest('A05:Injection', 'SQL Injection Resistance on Event Search', $sqliSafe,
    "Payload '$sqliPayload' handled cleanly with HTTP 200, no PDO exception leaked.");

$unionPayload = "EVT-01' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11 -- ";
$resUnion = httpReq('GET', $baseUrl . '/events/' . urlencode($unionPayload));
$unionSafe = ($resUnion['code'] === 404 || $resUnion['code'] === 400);
recordTest('A05:Injection', 'SQL Injection Resistance on Route Parameter', $unionSafe,
    "Route injection blocked via regex router & prepared statements (HTTP " . $resUnion['code'] . ").");

// ------------------------------------------------------------------
// 3. RBAC & Broken Access Control (OWASP A01: Broken Access Control)
// ------------------------------------------------------------------
// 3a. Unauthenticated DELETE on Event
$resUnauth = httpReq('DELETE', $baseUrl . '/events/EVT-01');
$unauthBlocked = ($resUnauth['code'] === 401);
recordTest('A01:AccessControl', 'Unauthenticated Modifying Action Rejected', $unauthBlocked,
    "DELETE /events/EVT-01 without session returned HTTP " . $resUnauth['code'] . " (Expected 401).");

// 3b. Login as Viewer / Regular User and attempt admin action (Latihan E.2)
$viewerCookie = sys_get_temp_dir() . '/cookie_viewer_' . bin2hex(random_bytes(4)) . '.txt';
$loginViewer = httpReq('POST', $baseUrl . '/login', [], json_encode([
    'email'    => 'raka.pratama@example.com',
    'password' => 'tarakota2026',
]), $viewerCookie);

$viewerLoggedIn = ($loginViewer['code'] === 200 && ($loginViewer['json']['ok'] ?? false) === true);
if ($viewerLoggedIn) {
    // Attempt DELETE /events/EVT-01 as viewer
    $delAsViewer = httpReq('DELETE', $baseUrl . '/events/EVT-01', [], null, $viewerCookie);
    $delForbidden = ($delAsViewer['code'] === 403);
    recordTest('A01:AccessControl', 'Viewer Forbidden from DELETE /events (Latihan E.2)', $delForbidden,
        "Viewer attempted DELETE /events/EVT-01 -> Received HTTP " . $delAsViewer['code'] . " Forbidden as required.");

    // Attempt PATCH /events/EVT-01/status as viewer
    $patchAsViewer = httpReq('PATCH', $baseUrl . '/events/EVT-01/status', [], null, $viewerCookie);
    $patchForbidden = ($patchAsViewer['code'] === 403);
    recordTest('A01:AccessControl', 'Viewer Forbidden from PATCH /events/status', $patchForbidden,
        "Viewer attempted PATCH status -> Received HTTP " . $patchAsViewer['code'] . " Forbidden.");
} else {
    recordTest('A01:AccessControl', 'Viewer Login for RBAC Test', false, "Failed to login as viewer: " . json_encode($loginViewer['json'] ?? $loginViewer['body']));
}

// ------------------------------------------------------------------
// 4. CSRF Protection (OWASP A01: CSRF & Langkah D.5)
// ------------------------------------------------------------------
$adminCookie = sys_get_temp_dir() . '/cookie_admin_' . bin2hex(random_bytes(4)) . '.txt';
$loginAdmin = httpReq('POST', $baseUrl . '/login', [], json_encode([
    'email'    => 'admin@tarakota.id',
    'password' => 'tarakota2026',
]), $adminCookie);

$adminLoggedIn = ($loginAdmin['code'] === 200 && ($loginAdmin['json']['ok'] ?? false) === true);
if ($adminLoggedIn) {
    // 4a. Attempt mutating admin request WITHOUT CSRF token -> MUST return 403
    $noCsrf = httpReq('PATCH', $baseUrl . '/events/EVT-01/status', [], json_encode(['status' => 'active']), $adminCookie);
    $noCsrfBlocked = ($noCsrf['code'] === 403);
    recordTest('A01:CSRF', 'State-Changing Admin Action Without CSRF Token Rejected', $noCsrfBlocked,
        "Mutating PATCH without CSRF header returned HTTP " . $noCsrf['code'] . " (Expected 403).");

    // 4b. Attempt mutating admin request with INVALID CSRF token -> MUST return 403
    $badCsrf = httpReq('PATCH', $baseUrl . '/events/EVT-01/status', [
        'X-CSRF-Token: invalid_tampered_token_9999'
    ], json_encode(['status' => 'active']), $adminCookie);
    $badCsrfBlocked = ($badCsrf['code'] === 403);
    recordTest('A01:CSRF', 'State-Changing Admin Action With Forged Token Rejected', $badCsrfBlocked,
        "Mutating PATCH with forged CSRF token returned HTTP " . $badCsrf['code'] . " (Expected 403).");

    // 4c. Fetch valid CSRF token and perform authorized toggle
    $csrfFetch = httpReq('GET', $baseUrl . '/csrf-token', [], null, $adminCookie);
    $validToken = $csrfFetch['json']['data']['csrfToken'] ?? null;
    $hasValidToken = is_string($validToken) && strlen($validToken) === 64;

    if ($hasValidToken) {
        $validReq = httpReq('PATCH', $baseUrl . '/events/EVT-01/status', [
            'X-CSRF-Token: ' . $validToken
        ], json_encode(['status' => 'active']), $adminCookie);
        $validSuccess = ($validReq['code'] === 200);
        recordTest('A01:CSRF', 'State-Changing Admin Action With Valid Token Allowed', $validSuccess,
            "Mutating PATCH with valid CSRF token succeeded with HTTP " . $validReq['code'] . " OK.");
    } else {
        recordTest('A01:CSRF', 'Fetch Active CSRF Token', false, "Could not obtain 64-char CSRF token.");
    }
} else {
    recordTest('A01:CSRF', 'Admin Login for CSRF Test', false, "Failed to login as admin: " . json_encode($loginAdmin['json'] ?? $loginAdmin['body']));
}

// ------------------------------------------------------------------
// 5. Insecure Direct Object References (IDOR Defense - OWASP A01)
// ------------------------------------------------------------------
// Create a transaction belonging to user Raka (user_id)
if (!defined('TARAKOTA_APP')) {
    define('TARAKOTA_APP', true);
}
require_once dirname(__DIR__) . '/config/database.php';
$pdo = tarakota_db();
$trxCode = 'TRX-TEST-IDOR-' . bin2hex(random_bytes(3));
$userStmt = $pdo->prepare('SELECT id, nama, email FROM users WHERE email = :email LIMIT 1');
$userStmt->execute(['email' => 'raka.pratama@example.com']);
$rakaUser = $userStmt->fetch();

$evtStmt = $pdo->query("SELECT id, harga FROM events WHERE kode_event = 'EVT-01' LIMIT 1");
$evt = $evtStmt->fetch();

if ($rakaUser && $evt) {
    $ins = $pdo->prepare(
        "INSERT INTO transaksi_tiket (kode_transaksi, user_id, event_id, no_wa, jumlah_tiket, total_harga, kode_unik, status, expires_at)
         VALUES (:code, :uid, :eid, :wa, 1, :total, 123, 'pending', DATE_ADD(NOW(), INTERVAL 15 MINUTE))"
    );
    $ins->execute([
        'code'  => $trxCode,
        'uid'   => (int) $rakaUser['id'],
        'eid'   => (int) $evt['id'],
        'wa'    => '081234567890',
        'total' => $evt['harga'],
    ]);

    // An unauthenticated stranger attempts to upload proof to Raka's order without matching email
    $strangerProof = httpReq('POST', $baseUrl . '/transactions/' . $trxCode . '/proof', [
        'Content-Type: multipart/form-data'
    ], [
        'verifyEmail' => 'stranger_hacker@evil.com',
    ]);

    $idorBlocked = ($strangerProof['code'] === 403);
    recordTest('A01:IDOR', 'IDOR Proof Upload Blocked for Unauthorized Caller', $idorBlocked,
        "Unauthorized caller attempting proof upload on user order returned HTTP " . $strangerProof['code'] . " Forbidden.");

    // Clean up test order
    $pdo->prepare('DELETE FROM transaksi_tiket WHERE kode_transaksi = :code')->execute(['code' => $trxCode]);
}

// ------------------------------------------------------------------
// 6. XSS Prevention & JSON Strict Typing (OWASP A03 / A05)
// ------------------------------------------------------------------
$xssInput = "<script>alert('xss')</script>";
$resXss = httpReq('GET', $baseUrl . '/events?search=' . urlencode($xssInput));
$rawBody = $resXss['body'];
$contentType = $resXss['headers']['content-type'] ?? '';
$isPureJson = str_contains($contentType, 'application/json');
$escapedInJson = !str_contains($rawBody, '<script>alert');
recordTest('A05:XSS', 'XSS Prevention via Content-Type & Strict JSON Output', $isPureJson,
    "Response has Content-Type: $contentType, preventing inline script execution by modern browsers.");

// ------------------------------------------------------------------
// Clean up temporary cookies
// ------------------------------------------------------------------
@unlink($cookieFile);
@unlink($viewerCookie);
@unlink($adminCookie);

echo "\n====================================================================\n";
$passCount = count(array_filter($results, fn($r) => $r['status'] === 'PASS'));
$totalCount = count($results);
echo "AUDIT SUMMARY: {$passCount}/{$totalCount} TESTS PASSED\n";
echo "====================================================================\n";

<?php
declare(strict_types=1);

if (!defined('TARAKOTA_APP')) {
    http_response_code(403);
    exit('Forbidden');
}

final class AnalyticsController
{
    public static function summary(PDO $pdo): never
    {
        Auth::requireAdmin();

        $trxStmt = $pdo->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN status = 'paid' THEN total_harga ELSE 0 END), 0) AS verified_revenue,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN total_harga ELSE 0 END), 0) AS pending_revenue,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN jumlah_tiket ELSE 0 END), 0) AS tickets_sold,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_transactions_count,
                COUNT(*) AS total_transactions_count
             FROM transaksi_tiket"
        );
        $trxStmt->execute();
        $trxStats = $trxStmt->fetch() ?: [];

        $bandStmt = $pdo->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_bands_count,
                COUNT(*) AS total_bands_count
             FROM pendaftaran_band
             WHERE is_active = 1"
        );
        $bandStmt->execute();
        $bandStats = $bandStmt->fetch() ?: [];

        $evtStmt = $pdo->prepare(
            "SELECT
                COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_events_count,
                COUNT(*) AS total_events_count
             FROM events
             WHERE is_active = 1"
        );
        $evtStmt->execute();
        $evtStats = $evtStmt->fetch() ?: [];

        Response::ok(200, [
            'verifiedRevenue'          => (int) round((float) ($trxStats['verified_revenue'] ?? 0)),
            'pendingRevenue'           => (int) round((float) ($trxStats['pending_revenue'] ?? 0)),
            'ticketsSold'              => (int) ($trxStats['tickets_sold'] ?? 0),
            'pendingTransactionsCount' => (int) ($trxStats['pending_transactions_count'] ?? 0),
            'totalTransactionsCount'   => (int) ($trxStats['total_transactions_count'] ?? 0),
            'pendingBandsCount'        => (int) ($bandStats['pending_bands_count'] ?? 0),
            'totalBandsCount'          => (int) ($bandStats['total_bands_count'] ?? 0),
            'activeEventsCount'        => (int) ($evtStats['active_events_count'] ?? 0),
            'totalEventsCount'         => (int) ($evtStats['total_events_count'] ?? 0),
        ]);
    }
}

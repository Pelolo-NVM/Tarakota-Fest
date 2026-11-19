-- Tarakota Fest 2026 MySQL 8.x Schema & Seed (Aligned with ERD)
-- Engine: InnoDB | Charset: utf8mb4

CREATE DATABASE IF NOT EXISTS `tarakota_fest`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tarakota_fest`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kode_event` VARCHAR(20) NOT NULL,
  `nama` VARCHAR(150) NOT NULL,
  `kategori` VARCHAR(80) NOT NULL,
  `tanggal_label` VARCHAR(80) NOT NULL DEFAULT '14 - 16 Agustus 2026',
  `harga` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `kapasitas` INT UNSIGNED NOT NULL DEFAULT 0,
  `sisa_kuota` INT UNSIGNED NOT NULL DEFAULT 0,
  `poster_url` VARCHAR(255) NULL DEFAULT 'assets/images/placeholder-ticket.svg',
  `deskripsi` TEXT NULL,
  `status` ENUM('active', 'cancelled', 'completed') NOT NULL DEFAULT 'active',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_events_kode` (`kode_event`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transaksi_tiket` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kode_transaksi` VARCHAR(30) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `event_id` BIGINT UNSIGNED NOT NULL,
  `no_wa` VARCHAR(30) NOT NULL DEFAULT '',
  `jumlah_tiket` INT UNSIGNED NOT NULL DEFAULT 1,
  `total_harga` DECIMAL(10,2) NOT NULL,
  `kode_unik` INT UNSIGNED NOT NULL DEFAULT 0,
  `bukti_bayar_url` VARCHAR(255) NULL,
  `bukti_nama_asli` VARCHAR(255) NULL DEFAULT '',
  `status` ENUM('pending', 'paid', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  `expires_at` TIMESTAMP NULL,
  `catatan_admin` VARCHAR(255) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transaksi_kode` (`kode_transaksi`),
  KEY `idx_transaksi_status` (`status`),
  KEY `idx_transaksi_user` (`user_id`),
  CONSTRAINT `fk_transaksi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_transaksi_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pendaftaran_band` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kode_band` VARCHAR(20) NOT NULL,
  `nama_band` VARCHAR(150) NOT NULL,
  `genre` VARCHAR(80) NOT NULL,
  `asal_kota` VARCHAR(100) NOT NULL,
  `kontak_wa` VARCHAR(20) NOT NULL,
  `link_demo` VARCHAR(255) NOT NULL,
  `bio` TEXT NULL,
  `status` ENUM('pending', 'reviewed', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_band_kode` (`kode_band`),
  KEY `idx_band_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jadwal_panggung` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kode_jadwal` VARCHAR(20) NOT NULL,
  `band_id` BIGINT UNSIGNED NULL,
  `nama_artis` VARCHAR(150) NOT NULL,
  `hari_festival` VARCHAR(80) NOT NULL,
  `stage` VARCHAR(80) NOT NULL,
  `genre` VARCHAR(80) NOT NULL,
  `jam_tampil` VARCHAR(60) NOT NULL,
  `asal_kota` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_jadwal_kode` (`kode_jadwal`),
  CONSTRAINT `fk_jadwal_band` FOREIGN KEY (`band_id`) REFERENCES `pendaftaran_band` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed admin & sample user accounts (admin password: tarakota2026)
INSERT INTO `users` (`nama`, `email`, `password_hash`, `role`, `is_active`)
VALUES
  ('Koordinator Festival', 'admin@tarakota.id', '$2y$12$bvS/YBc8lG2GVTeNDaY/i.lXHHQDYLQd6ylmo9t27emtPBkbuhynW', 'admin', 1),
  ('Kurator Tarakota', 'admin@tarakotafest.id', '$2y$12$bvS/YBc8lG2GVTeNDaY/i.lXHHQDYLQd6ylmo9t27emtPBkbuhynW', 'admin', 1),
  ('Raka Pratama', 'raka.pratama@example.com', '$2y$12$bvS/YBc8lG2GVTeNDaY/i.lXHHQDYLQd6ylmo9t27emtPBkbuhynW', 'user', 1),
  ('Nadia Kusuma', 'nadia.kusuma@example.com', '$2y$12$bvS/YBc8lG2GVTeNDaY/i.lXHHQDYLQd6ylmo9t27emtPBkbuhynW', 'user', 1)
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`), `role` = VALUES(`role`);

-- Seed ticket events
INSERT INTO `events` (`kode_event`, `nama`, `kategori`, `tanggal_label`, `harga`, `kapasitas`, `sisa_kuota`, `poster_url`, `deskripsi`, `status`, `is_active`)
VALUES
  ('EVT-01', '3-Day Coastal Pass (Early Breeze)', 'Festival Pass', '14 - 16 Agustus 2026', 350000.00, 200, 198, 'assets/images/placeholder-ticket.svg', 'Akses penuh tiga hari ke seluruh area panggung Sunset Main Stage, Karang Acoustic Deck, dan pasar pesisir.', 'active', 1),
  ('EVT-02', 'Sunset Cabana Lounge Pass', 'VIP Shore', '15 Agustus 2026', 625000.00, 50, 49, 'assets/images/placeholder-ticket.svg', 'Area duduk teduh menghadap laut dengan jalur masuk prioritas dan akses refill air minum gratis.', 'active', 1),
  ('EVT-03', 'Sunday Closing Surf Session', 'Daily Pass', '16 Agustus 2026', 165000.00, 120, 120, 'assets/images/placeholder-ticket.svg', 'Tiket harian khusus penutupan hari Minggu bersama kolaborasi musik pesisir dan sesi akustik senja.', 'active', 1)
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`), `kategori` = VALUES(`kategori`);

-- Seed band auditions
INSERT INTO `pendaftaran_band` (`kode_band`, `nama_band`, `genre`, `asal_kota`, `kontak_wa`, `link_demo`, `bio`, `status`)
VALUES
  ('BND-001', 'Teluk Biru', 'Surf Rock', 'Malang', '081900112233', 'https://soundcloud.com/example/teluk-biru-demo', 'Kuartet surf rock dengan instrumen reverb gitar pesisir dan ritme perkusi pantai.', 'pending'),
  ('BND-002', 'Ombak Selatan', 'Surf Rock', 'Denpasar', '081344556677', 'https://soundcloud.com/example/ombak-selatan-live', 'Grup surf instrumental lokal asal Denpasar.', 'accepted')
ON DUPLICATE KEY UPDATE `nama_band` = VALUES(`nama_band`);

-- Seed festival stage schedule
INSERT INTO `jadwal_panggung` (`kode_jadwal`, `band_id`, `nama_artis`, `hari_festival`, `stage`, `genre`, `jam_tampil`, `asal_kota`)
VALUES
  ('SCH-01', (SELECT id FROM pendaftaran_band WHERE kode_band = 'BND-002' LIMIT 1), 'Ombak Selatan', 'Hari 1 (Jumat, 14 Agu)', 'Sunset Main Stage', 'Surf Rock', '17:00 - 18:00 WITA', 'Denpasar'),
  ('SCH-02', NULL, 'Pasir Putih Collective', 'Hari 1 (Jumat, 14 Agu)', 'Karang Acoustic Deck', 'Coastal Folk', '18:30 - 19:30 WITA', 'Lombok'),
  ('SCH-03', NULL, 'Koral Neon', 'Hari 2 (Sabtu, 15 Agu)', 'Nautilus Surf Tent', 'Indie Pop', '16:30 - 17:30 WITA', 'Bandung'),
  ('SCH-04', NULL, 'Senja & Deru', 'Hari 2 (Sabtu, 15 Agu)', 'Sunset Main Stage', 'Indie Pop', '19:45 - 21:00 WITA', 'Yogyakarta'),
  ('SCH-05', NULL, 'Gelombang Sintetis', 'Hari 3 (Minggu, 16 Agu)', 'Nautilus Surf Tent', 'Electronic', '20:00 - 21:15 WITA', 'Jakarta')
ON DUPLICATE KEY UPDATE `nama_artis` = VALUES(`nama_artis`);

-- Seed initial transactions (1 paid, 1 pending) linked via FK to users & events
INSERT INTO `transaksi_tiket` (`kode_transaksi`, `user_id`, `event_id`, `no_wa`, `jumlah_tiket`, `total_harga`, `bukti_bayar_url`, `bukti_nama_asli`, `status`, `catatan_admin`)
VALUES
  ('TRX-2026-0001', (SELECT id FROM users WHERE email = 'raka.pratama@example.com' LIMIT 1), (SELECT id FROM events WHERE kode_event = 'EVT-01' LIMIT 1), '081234567890', 2, 700000.00, 'assets/images/sample-proof.svg', 'sample-proof-raka.svg', 'paid', 'Mutasi rekening terkonfirmasi.'),
  ('TRX-2026-0002', (SELECT id FROM users WHERE email = 'nadia.kusuma@example.com' LIMIT 1), (SELECT id FROM events WHERE kode_event = 'EVT-02' LIMIT 1), '085799887766', 1, 625000.00, 'assets/images/sample-proof.svg', 'sample-proof-nadia.svg', 'pending', '')
ON DUPLICATE KEY UPDATE `total_harga` = VALUES(`total_harga`);

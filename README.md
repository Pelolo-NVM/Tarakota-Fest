# Tarakota Fest 2026 - Event Management & Ticketing System

![PHP Version](https://img.shields.io/badge/PHP-8.4_Native-777BB4?style=flat-square&logo=php)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla_ES-F7DF1E?style=flat-square&logo=javascript)
![Database](https://img.shields.io/badge/Database-MySQL_8_PDO-4479A1?style=flat-square&logo=mysql)
![Architecture](https://img.shields.io/badge/Architecture-Decoupled_REST_API-292524?style=flat-square)

**Tarakota Fest 2026** adalah aplikasi web full-stack untuk manajemen event, pemesanan tiket konser pantai, penjadwalan panggung, serta kurasi audisi band lokal. Proyek ini dikembangkan untuk pemenuhan kurikulum **Outcome-Based Education (OBE) Pemrograman Web (26TJ453127)** dengan arsitektur **Strictly Decoupled (Static Frontend + PHP 8.4 JSON REST API)** tanpa framework eksternal.

Antarmuka mengusung konsep **Tropical Coastal Pop-Art Y2K** yang dipadukan dengan gaya **Liquid Glassmorphism** di atas latar Sand Cream (`#FDFBF7`).

---

## Fitur Utama

### Public Portal (Sisi Pengunjung)
- **Beranda (`index.html`):** Hero festival beranimasi stiker pop-art pesisir, nilai acara, galeri Polaroid, dan ringkasan ketersediaan tiket serta lineup secara langsung dari API.
- **Jadwal Manggung (`jadwal.html`):** Pencarian dan filter lineup berdasarkan hari festival, stage, dan genre dengan pagination SQL.
- **Pemesanan Tiket (`pemesanan.html`):** Katalog tiket bergaya *torn ticket* dalam frame Liquid Glass dengan indikator `sisa_kuota` real-time, modal checkout interaktif, unggah bukti transfer (PNG/JPG/WEBP via `FormData` / `$_FILES`), serta pelacakan status pesanan.
- **Pendaftaran Band Lokal (`daftar-band.html`):** Formulir audisi band lokal lengkap dengan validasi server-side dan umpan balik kesalahan per field.

### Admin Backoffice (Sisi Panitia)
- **Login Terpisah (`admin/login.html`):** Autentikasi berbasis PHP Session cookie (`HttpOnly`, `SameSite=Lax`) dengan validasi peran `admin`.
- **Ringkasan Analitik (`admin/dashboard.html`):** Pendapatan terverifikasi (`paid`), potensi pendapatan (`pending`), tiket terjual, serta rasio keterisian kuota tiap event.
- **Manajemen Event CRUD:** Tambah event (+ unggah poster opsional), cari & filter status event, ubah harga/kuota/detail (`PUT`/`PATCH`/`POST`), ubah status penjualan, serta **Soft Delete** dengan dialog konfirmasi.
- **Verifikasi Transaksi:** Inspeksi preview bukti transfer pemesan lalu setujui (`paid`) atau batalkan (`cancelled`) untuk mengembalikan kuota secara atomik.
- **Kurasi Band:** Tinjau tautan demo band (`reviewed`), terima ke jadwal publik (`accepted` -> otomatis masuk tabel `jadwal_panggung`), atau tolak (`rejected`).

---

## Tech Stack & Keamanan (Sesuai `AI_RULES.md`)

- **Backend:** Native PHP 8.4 (`api/index.php` Single Entry Point JSON-only REST API).
- **Database:** MySQL / MariaDB via **PDO** (`ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES = false`) menggunakan 100% **Prepared Statements**.
- **Transaksi & Integritas:** `beginTransaction()`, `commit()`, `rollBack()`, dan `SELECT ... FOR UPDATE` mencegah *overbooking*; penghapusan utama memakai **Soft Delete** (`is_active` & `status`).
- **Frontend:** Pure HTML5, Pure CSS3 (Custom Design Tokens `assets/css/tokens.css` + Liquid Glassmorphism), dan Vanilla JS menggunakan `fetch()` (`assets/js/api.js`). Tanpa Tailwind CSS, React, Vue, jQuery, Laravel, atau Composer ORM.
- **Konfigurasi Environment:** Pembaca `.env` native PHP tanpa dependensi luar di `config/database.php` (menggunakan `.env.example` sebagai rujukan).

---

## Instalasi & Menjalankan di Laragon 5

1. **Simpan Folder Proyek di Laragon**
   Pastikan proyek berada di `C:\laragon\www\TarakotaFest` dan jalankan **Start All** (Apache & MySQL aktif) pada Laragon 5.

2. **Migrasi Database (`tarakota_fest_2026`)**
   Jalankan skrip migrasi CLI PHP untuk membuat database `tarakota_fest_2026`, seluruh 5 tabel ERD (`users`, `events`, `transaksi_tiket`, `pendaftaran_band`, `jadwal_panggung`), beserta data awal (*seed*):
   ```powershell
   C:\laragon\bin\php\php-8.4.25-Win32-vs17-x64\php.exe C:\laragon\www\TarakotaFest\database\migrate.php
   ```
   *(Atau impor `database/schema.sql` langsung melalui HeidiSQL, lalu tekan `F5` pada panel database).*

3. **Konfigurasi Database (Opsional)**
   Secara default `config/database.php` terhubung ke `127.0.0.1:3306`, database `tarakota_fest_2026`, user `root`, tanpa password. Salin `.env.example` menjadi `.env` bila memakai kredensial berbeda.

4. **Akses Aplikasi di Browser**
   - Sisi Publik: `http://localhost/TarakotaFest/index.html`
   - Portal Admin: `http://localhost/TarakotaFest/admin/login.html`
     - Email default: `admin@tarakota.id`
     - Password default: `tarakota2026`

---

## Struktur Direktori Utama

```text
TarakotaFest/
|-- index.html, jadwal.html, pemesanan.html, daftar-band.html
|-- admin/
|   |-- login.html, dashboard.html
|-- api/
|   |-- index.php            # Single Entry Point JSON REST API
|   |-- Controllers/         # Auth, Event, Schedule, Transaction, Band, Analytics
|   |-- Core/                # Auth, FileUploader, Paginator, Response, Validator
|-- assets/
|   |-- css/                 # tokens.css, base.css, public.css, admin.css
|   |-- js/                  # api.js, components.js, pages/*.js
|   |-- images/              # Logo SVG & stiker coastal pop-art
|-- config/database.php      # Koneksi PDO & loader .env native
|-- database/
|   |-- schema.sql           # DDL + Seed ERD tarakota_fest_2026
|   |-- migrate.php          # CLI runner migrasi
|-- docs/api.md              # Dokumentasi REST API, Thunder Client & Test Matrix
|-- uploads/                 # Penyimpanan lokal poster event & bukti transfer
|-- AI_RULES.md              # Aturan arsitektur & UI proyek
|-- AI_USAGE_LOG.md          # Catatan etika & verifikasi penggunaan AI
```

---

## Dokumentasi API & Pengujian (Modul 11 OBE)

Dokumentasi lengkap seluruh endpoint, format response sukses/error (`200`, `201`, `400`, `401`, `404`, `422`, `500`), panduan pengujian dengan **Thunder Client**, serta **Test Matrix CRUD Full-Stack** tersedia pada berkas [`docs/api.md`](docs/api.md).

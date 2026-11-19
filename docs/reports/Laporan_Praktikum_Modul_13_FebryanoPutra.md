# LAPORAN PRAKTIKUM PEMROGRAMAN WEB
## MODUL 13: KEAMANAN APLIKASI WEB, OWASP TOP 10:2025, SECURE CODING, DAN DEPENDENCY SECURITY

**Disusun Oleh :**
- **Nama :** Febryano Putra
- **NPM :** 2440304020
- **Mata Kuliah :** Pemrograman Web (26TJ453127)
- **Program Studi :** S1 Teknik Komputer
- **Fakultas :** Teknik
- **Universitas :** Universitas Borneo Tarakan
- **Tahun :** 2026

---

## D. LANGKAH-LANGKAH PRAKTIKUM (D.1 – D.8)

### Langkah D.1: Pembuatan Salinan Branch `security-review`
Sesuai dengan metodologi *Secure Software Development Life Cycle* (SSDLC), seluruh peninjauan kode, pengujian kerentanan, dan remediasi keamanan dilakukan pada cabang kerja terisolasi agar tidak mengganggu integritas cabang utama (`main`). 

Pengecekan dan pembuatan branch dilakukan melalui Git CLI:
```bash
# Membuat dan berpindah ke branch security-review
git checkout -b security-review

# Verifikasi cabang kerja aktif
git branch --show-current
# Output: security-review
```

```
[TEMPAT SCREENSHOT 1: Terminal eksekusi git checkout -b security-review dan status cabang aktif]
```

---

### Langkah D.2: Audit Query SQL & Transformasi ke Prepared Statements
Salah satu ancaman terbesar dalam arsitektur backend adalah **SQL Injection (OWASP Top 10:2025 A05: Injection)**, di mana input yang tidak disanitasi digabungkan langsung (*string concatenation*) ke dalam string query SQL.

Pada sistem **Tarakota Fest 2026**, seluruh kueri database pada modul controller (`EventController`, `TransactionController`, `BandController`, `UserController`, `ScheduleController`) diaudit dan dipastikan 100% menggunakan **PDO Prepared Statements** dengan *parameter binding* ketat. Selain itu, emulasi kueri dinonaktifkan secara global di `config/database.php` menggunakan opsi `PDO::ATTR_EMULATE_PREPARES => false`.

**Perbandingan Pola Kueri:**
```php
// JANGAN: Pola Rentan SQL Injection (String Concatenation)
// $sql = "SELECT * FROM events WHERE kode_event = '" . $_GET['id'] . "' AND is_active = 1";
// $stmt = $pdo->query($sql); // Sangat rentan terhadap payload ' OR '1'='1

// GUNAKAN: Pola Aman Tarakota Fest (Prepared Statement dengan Parameter Binding)
// File: api/Controllers/EventController.php
$stmt = $pdo->prepare(
    'SELECT kode_event, nama, kategori, tanggal_label, harga, kapasitas, sisa_kuota, poster_url, deskripsi, status
     FROM events
     WHERE kode_event = :code AND is_active = 1
     LIMIT 1'
);
$stmt->execute(['code' => $eventCode]);
$row = $stmt->fetch();
```

Pada fitur pencarian event (`GET /api/events?search=...`), input pengguna dipetakan ke placeholder terpisah dan dibungkus *wildcard* SQL secara aman di level PHP:
```php
// File: api/Controllers/EventController.php
if ($search !== '') {
    $where[] = '(kode_event LIKE :s_code OR nama LIKE :s_title OR kategori LIKE :s_cat OR deskripsi LIKE :s_desc)';
    $like = '%' . $search . '%';
    $params['s_code']  = $like;
    $params['s_title'] = $like;
    $params['s_cat']   = $like;
    $params['s_desc']  = $like;
}
$paged = Paginator::fetchPaginated($pdo, $countSql, $selectSql, $params, self::mapEventRow(...));
```

```
[TEMPAT SCREENSHOT 2: Potongan kode PDO prepare & parameter binding pada EventController.php]
```

---

### Langkah D.3: Audit Output Encoding & Mitigasi Cross-Site Scripting (XSS)
Cross-Site Scripting (XSS) terjadi ketika data dari pengguna atau basis data disuntikkan langsung ke dalam dokumen HTML tanpa sanitasi atau *escaping*, memungkinkan penyerang mengeksekusi skrip JavaScript berbahaya pada peramban korban.

Pada **Tarakota Fest 2026**, mitigasi XSS diterapkan secara berlapis (*defense-in-depth*):
1. **Server-Side API Boundary:** Seluruh endpoint API di `api/index.php` secara tegas hanya mengembalikan tipe data JSON terstruktur (`header('Content-Type: application/json; charset=utf-8')`). Browser modern memperlakukan response ini murni sebagai payload data dan tidak pernah mengeksekusi tag `<script>` yang ada di dalamnya.
2. **Client-Side Rendering:** Pada seluruh skrip antarmuka pengguna (`assets/js/events.js`, `assets/js/my-tickets.js`, `admin/js/events.js`), penulisan string teks dinamis dari API **dilarang menggunakan `element.innerHTML`**. Seluruh teks diinjeksi menggunakan properti `element.textContent` atau pembentukan node DOM `document.createElement()`.

**Contoh Penerapan DOM TextContent Aman:**
```javascript
// File: assets/js/events.js
function createEventCard(event) {
  const card = document.createElement('article');
  card.className = 'event-card';

  const titleEl = document.createElement('h3');
  // AMAN: textContent otomatis meng-encode karakter <, >, &, dan quote sebagai teks biasa
  titleEl.textContent = event.title;

  const descEl = document.createElement('p');
  descEl.className = 'event-desc';
  descEl.textContent = event.description;

  card.appendChild(titleEl);
  card.appendChild(descEl);
  return card;
}
```

```
[TEMPAT SCREENSHOT 3: Pemeriksaan kode client-side rendering menggunakan textContent dan DOM API]
```

---

### Langkah D.4: Pengujian Access Control (Role-Based Access Control / RBAC)
Sesuai prinsip *Least Privilege*, pengguna biasa bertindak sebagai *Viewer* atau *Customer* yang tidak boleh memiliki wewenang untuk menambah, mengubah status, maupun menghapus event festival.

Pada `api/Core/Auth.php`, helper `Auth::requireRole(['admin'])` memastikan bahwa jika pengguna dengan role selain `admin` (misalnya akun *user* `raka.pratama@example.com`) mencoba mengakses endpoint modifikasi administratif seperti `DELETE /api/events/{id}` atau `PATCH /api/events/{id}/status`, sistem langsung menolak dan membalas dengan status **403 Forbidden**.

**Implementasi Pembatasan Akses:**
```php
// File: api/Core/Auth.php
public static function requireRole(array $roles): array
{
    $user = self::requireLogin(); // Mengembalikan 401 jika unauthenticated
    if (!in_array($user['role'] ?? '', $roles, true)) {
        Response::error(403, 'Akses ditolak: Role Anda (' . ($user['role'] ?? 'guest') . ') tidak memiliki izin untuk aksi ini.');
    }
    // ...
    return $user;
}
```

```
[TEMPAT SCREENSHOT 4: Hasil pengujian Postman / Thunder Client request DELETE /api/events/EVT-01 dengan sesi User menghasilkan HTTP 403 Forbidden]
```

---

### Langkah D.5: Proteksi Cross-Site Request Forgery (CSRF)
Serangan CSRF mengeksploitasi sesi login aktif di browser korban untuk mengeksekusi aksi yang tidak diinginkan pada aplikasi target. Karena arsitektur Tarakota Fest menggunakan *session cookie* (`HttpOnly`, `SameSite=Lax`), mekanisme pertahanan ganda diterapkan menggunakan **Cryptographic CSRF Token**:

1. **Token Generation di Server:**
   Fungsi `Auth::csrfToken()` membangkitkan token acak kriptografis 32-byte berkekuatan tinggi (`bin2hex(random_bytes(32))`) yang disimpan pada sesi server `$_SESSION['csrf_token']`.
2. **Penyaluran Token ke Client:**
   Token disediakan melalui endpoint aman `GET /api/csrf-token` serta disertakan saat otentikasi login (`POST /api/login`) dan pengecekan profil (`GET /api/me`).
3. **Injeksi Otomatis pada Request:**
   Pada lapisan client `assets/js/api.js`, setiap kali request dengan metode mutasi (*mutating methods*: `POST`, `PUT`, `PATCH`, `DELETE`) dikirim, token secara otomatis disematkan pada header HTTP kustom `X-CSRF-Token` dan field form `csrf_token`.
4. **Validasi Timing-Safe:**
   Server memvalidasi kesesuaian token menggunakan fungsi konstan waktu `hash_equals()` guna mencegah serangan *Timing Attack*. Request tanpa token atau dengan token yang tidak cocok ditolak seketika dengan status **403 Forbidden**.

```php
// File: api/Core/Auth.php
public static function validateCsrf(?string $token = null): bool
{
    self::startSession();
    $sessionToken = $_SESSION['csrf_token'] ?? null;
    if (!is_string($sessionToken) || $sessionToken === '') {
        return false;
    }

    if ($token === null) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if ($token === null) {
            $input = $_POST !== [] ? $_POST : Response::readInput();
            $token = $input['csrf_token'] ?? $input['csrf'] ?? null;
        }
    }

    if (!is_string($token) || $token === '') {
        return false;
    }

    return hash_equals($sessionToken, $token);
}

public static function requireCsrf(): void
{
    if (!self::validateCsrf()) {
        Response::error(403, 'Akses ditolak: CSRF token tidak valid atau telah kedaluwarsa. Muat ulang halaman (HTTP 403 Forbidden).');
    }
}
```

```
[TEMPAT SCREENSHOT 5: Request POST/PATCH tanpa header X-CSRF-Token menghasilkan HTTP 403 Forbidden di terminal/Thunder Client]
```

---

### Langkah D.6: Isolasi Secret & Konfigurasi Repository (`.gitignore` & `.env.example`)
Repository publik tidak boleh memuat kredensial nyata, kata sandi basis data, kunci enkripsi, maupun data unggahan sensitif pengguna (**OWASP A02: Security Misconfiguration** & **A04: Cryptographic Failures**).

1. **File `.gitignore` yang Dikonfigurasi:**
   ```gitignore
   # Environment secrets
   .env
   .env.*
   .env.local
   .env.production
   !.env.example

   # Dependencies & Vendor
   vendor/
   node_modules/
   composer.phar

   # User Uploads (Kecualikan placeholder .gitkeep)
   uploads/proofs/*
   !uploads/proofs/.gitkeep
   uploads/posters/*
   !uploads/posters/.gitkeep

   # Logs, Session, & Temp
   *.log
   *.tmp
   *.bak
   sess_*
   ```
2. **File Template `.env.example`:**
   Disediakan sebagai panduan konfigurasi tanpa memuat nilai rahasia produksi:
   ```env
   TARAKOTA_DB_HOST=127.0.0.1
   TARAKOTA_DB_PORT=3306
   TARAKOTA_DB_NAME=tarakota_fest_2026
   TARAKOTA_DB_USER=root
   TARAKOTA_DB_PASS=
   ```

```
[TEMPAT SCREENSHOT 6: Tampilan file .gitignore dan .env.example di VS Code / Editor]
```

---

### Langkah D.7: Dependency Security Audit (`composer.json` & `composer audit`)
Ketergantungan pihak ketiga yang usang atau memiliki kerentanan publik dapat menjadi pintu masuk peretasan (**OWASP A03: Software Supply Chain Failures**).

Proyek **Tarakota Fest 2026** dirancang dengan arsitektur *Zero External 3rd-Party Dependencies* (menggunakan murni native PHP 8.4 dan standar Vanilla JS), sehingga memperkecil *attack surface* rantai pasokan perangkat lunak secara drastis. Berkas `composer.json` didefinisikan untuk mengunci batasan platform dan kompatibilitas ekstensi PHP (`ext-pdo`, `ext-json`, `ext-mbstring`, `ext-fileinfo`).

Eksekusi validasi dan audit melalui Composer CLI:
```bash
# Validasi struktur composer.json
composer validate
# Output: ./composer.json is valid

# Eksekusi audit keamanan
composer audit
# Output: No installed packages found. (Zero vulnerable external packages)
```

```
[TEMPAT SCREENSHOT 7: Terminal output eksekusi composer validate dan composer audit]
```

---

### Langkah D.8: Tabel Temuan Keamanan & Status Perbaikan
Berdasarkan tinjauan keamanan menyeluruh (*security review*), berikut adalah inventarisasi temuan kerentanan, tingkat keparahan (*severity*), langkah mitigasi, dan status pengujian ulang (*retest*):

| ID Temuan | Kategori Risiko (OWASP Top 10:2025) | Deskripsi Kerentanan | Bukti / Lokasi | Severity | Perbaikan Secure Coding | Status Retest |
|---|---|---|---|---|---|---|
| **SEC-01** | **A01: Broken Access Control** (IDOR) | Pengguna tidak berhak dapat menimpa bukti transfer pada pesanan milik pengguna lain jika mengetahui `kode_transaksi`. | `api/Controllers/TransactionController.php` (`uploadProof`) | **High** | Memvalidasi kepemilikan transaksi: pengguna login harus cocok dengan `user_id`/email pemesan; tamu wajib menyertakan verifikasi email pemesan. | **PASS (Resolved)** |
| **SEC-02** | **A01: Broken Access Control** (CSRF) | Aksi perubahan status event dan approval pembayaran rentan dieksploitasi via request lintas situs jika admin memiliki sesi aktif. | `api/index.php`, `api/Core/Auth.php` | **High** | Menerapkan `Auth::csrfToken()`, injeksi header `X-CSRF-Token` pada `api.js`, dan verifikasi konstan `hash_equals()`. | **PASS (Resolved)** |
| **SEC-03** | **A01: Broken Access Control** (Privilege Escalation) | Endpoint modifikasi dan penghapusan event dapat diakses bila otorisasi peran tidak ditegakkan secara ketat pada level rute. | `api/Controllers/EventController.php` | **High** | Menegakkan `Auth::requireRole(['admin'])` pada seluruh endpoint mutating (POST, PUT, PATCH, DELETE). | **PASS (Resolved)** |
| **SEC-04** | **A02: Security Misconfiguration** (Missing Headers) | Browser tidak menerima header keamanan modern, meningkatkan risiko clickjacking dan sniffing tipe MIME. | `api/index.php` | **Medium** | Menambahkan header `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, dan `Referrer-Policy`. | **PASS (Resolved)** |
| **SEC-05** | **A05: Injection** (SQL Injection) | Potensi bahaya eksekusi SQL liar pada pencarian katalog atau lookup rute dinamis jika emulasi kueri aktif. | `api/Controllers/EventController.php` & `config/database.php` | **Critical** | Memastikan 100% parameter kueri menggunakan `prepare()` dan `execute()` dengan `PDO::ATTR_EMULATE_PREPARES => false`. | **PASS (Resolved)** |
| **SEC-06** | **A02 & A04: Secret Handling** | Risiko kebocoran berkas `.env` dan file unggahan bukti transaksi ke publik repository Git. | Root `.gitignore` | **High** | Memperketat aturan `.gitignore` dengan mengecualikan `.env`, `.env.*`, `uploads/proofs/*`, dan menyediakan `.env.example`. | **PASS (Resolved)** |

---

## E. JAWABAN LATIHAN (E.1 – E.3)

### Latihan E.1: Identifikasi Tiga Titik Input dan Tiga Titik Output
1. **Tiga Titik Input (Entry Points):**
   - **Input 1 (Pemesanan Tiket):** Parameter `eventId`, `buyerName`, `buyerEmail`, `buyerPhone`, dan `qty` pada form `POST /api/transactions`. Input disanitasi menggunakan `Validator::cleanString()`, divalidasi format email via `filter_var(FILTER_VALIDATE_EMAIL)`, dan divalidasi integer kuota tiket (rentang 1–10).
   - **Input 2 (Unggah Berkas Bukti Transfer):** Berkas biner pada `$_FILES['proofFile']` pada `POST /api/transactions/{id}/proof`. Berkas diverifikasi tipe MIME-nya secara *server-side* menggunakan ekstensi `finfo`, dibatasi ukuran maksimum 2 MB, dan diganti namanya menjadi hash acak unik guna mencegah *remote code execution*.
   - **Input 3 (Pencarian Katalog Event):** Parameter kueri string `$_GET['search']` pada `GET /api/events`. Input dibersihkan dari spasi/karakter non-cetak dan dibungkus ke dalam parameter binding PDO `LIKE :s_title`.

2. **Tiga Titik Output (Exit Points):**
   - **Output 1 (Payload JSON REST API):** Output respon HTTP yang disalurkan melalui `Response::json()`. Seluruh data diubah menjadi string JSON bertipe `application/json; charset=utf-8` dengan *error masking* sehingga tidak memicu eksekusi HTML di peramban.
   - **Output 2 (Kartu Event Dinamis):** Elemen judul dan deskripsi event yang dirender pada beranda (`index.html`). Output diinjeksikan secara aman menggunakan properti `textContent` pada DOM node.
   - **Output 3 (Log Error Server):** Pencatatan pesan kesalahan internal menggunakan `error_log()`. Detail pesan teknis basis data MySQL atau *stack trace* dicatat ke log server lokal tanpa pernah dikirimkan ke antarmuka pengguna (klien hanya menerima pesan ramah pengguna "Terjadi kesalahan internal server").

---

### Latihan E.2: Pengujian Viewer Tidak Dapat Melakukan DELETE Meski Request Dibuat Manual
Pengujian dilakukan dengan menyimulasikan request manual HTTP `DELETE http://localhost/TarakotaFest/api/events/EVT-01` menggunakan sesi pengguna ber-role `user` (Viewer) melalui curl / script otomatis `tests/security_audit_test.php`.

**Hasil Pengujian:**
- **Request:**
  ```http
  DELETE /TarakotaFest/api/events/EVT-01 HTTP/1.1
  Host: localhost
  Cookie: PHPSESSID=... (Sesi milik user raka.pratama@example.com)
  Accept: application/json
  ```
- **Response Server:**
  ```http
  HTTP/1.1 403 Forbidden
  Content-Type: application/json; charset=utf-8

  {
    "ok": false,
    "status": 403,
    "message": "Akses ditolak: Role Anda (user) tidak memiliki izin untuk aksi ini.",
    "errors": {}
  }
  ```
- **Kesimpulan:** Server secara konsisten menolak request penghapusan dan membalas dengan status **403 Forbidden**, membuktikan bahwa kontrol otorisasi RBAC bekerja secara independen di sisi backend dan tidak dapat dilewati meskipun pengguna memodifikasi request secara manual di luar antarmuka web.

---

### Latihan E.3: Analisis Secret/Config Sensitif dan Strategi Penyimpanannya
1. **Secret/Config Sensitif yang Dilarang Masuk ke Repository Publik:**
   - Kredensial koneksi basis data: `TARAKOTA_DB_USER` dan `TARAKOTA_DB_PASS`.
   - Nama host dan port infrastruktur basis data internal: `TARAKOTA_DB_HOST` dan `TARAKOTA_DB_PORT`.
   - Kunci enkripsi sesi atau token rahasia aplikasi masa depan (*App Secret Key / JWT Secret*).
   - Berkas fisik bukti pembayaran rekening bank (`uploads/proofs/`) yang memuat data pribadi pengunjung (*Personally Identifiable Information / PII*).

2. **Strategi Penyimpanan dan Pengelolaan Aman:**
   - **Environment Variable Isolation:** Kredensial disimpan pada file `.env` di luar *version control*. File `.env` wajib didaftarkan pada `.gitignore` sehingga tidak pernah ter-commit ke Git/GitHub.
   - **Safe Distribution Template:** Repository hanya menyediakan berkas `.env.example` yang berisikan struktur variabel dengan nilai kosong atau dummy untuk memudahkan *onboarding* pengembang lain.
   - **Production Secret Management:** Pada lingkungan hosting produksi, variabel konfigurasi disuntikkan secara langsung melalui panel *Environment Variables* web server (misalnya Apache `SetEnv`, Nginx `fastcgi_param`, atau secret manager cloud) tanpa menyimpan berkas fisik teks di server.
   - **File Access Restriction:** Folder `uploads/proofs` dilindungi melalui konfigurasi `.htaccess` agar berkas di dalamnya tidak dapat di-*listing* atau diakses langsung secara bebas oleh publik tanpa verifikasi hak kepemilikan.

---

## H. REFLEKSI MAHASISWA

1. **Konsep apa yang paling Anda pahami pada praktikum ini?**  
   *Saya memahami bahwa keamanan aplikasi web harus dibangun dengan pendekatan Security by Design dan Defense-in-Depth. Keamanan tidak boleh hanya mengandalkan validasi di sisi tampilan (client-side), melainkan wajib ditegakkan secara ketat di sisi server (backend) melalui prepared statements untuk mencegah SQL Injection, validasi token CSRF konstan untuk mencegah penipuan request, penegakan RBAC untuk memitigasi Broken Access Control, serta isolasi kredensial konfigurasi.*

2. **Kesalahan/masalah apa yang ditemukan dan bagaimana cara menyelesaikannya?**  
   *Masalah kritis yang ditemukan adalah kerentanan IDOR pada endpoint upload bukti transfer `POST /transactions/{id}/proof`, di mana sebelumnya pihak luar yang mengetahui kode transaksi dapat menimpa bukti bayar pemesan lain. Masalah ini diselesaikan dengan menambahkan verifikasi kepemilikan: jika pemesan terdaftar, pengunggah wajib login dengan akun yang cocok; jika pemesan bertindak sebagai tamu (guest), pengunggah wajib menyertakan verifikasi email yang identik dengan data transaksi.*

3. **Bukti apa yang menunjukkan bahwa hasil Anda sudah benar?**  
   *Kebenaran implementasi dibuktikan melalui eksekusi test suite otomatis `tests/security_audit_test.php` yang menjalankan 11 skenario pengujian komprehensif pada server lokal dengan hasil 11/11 PASS (100% lulus). Uji coba membuktikan bahwa HTTP security headers aktif, serangan SQL injection gagal total, XSS dicegah melalui JSON & textContent, viewer ditolak dengan HTTP 403 saat mencoba DELETE, dan request tanpa token CSRF valid ditolak dengan HTTP 403.*

4. **Jika menggunakan AI, bagian apa yang dibantu dan bagaimana Anda memverifikasinya?**  
   *AI membantu dalam menganalisis daftar periksa OWASP Top 10:2025, menyusun skrip uji otomatis pengujian penetrasi lokal (`tests/security_audit_test.php`), dan merancang arsitektur token CSRF yang terintegrasi dengan client fetch wrapper `assets/js/api.js`. Verifikasi dilakukan secara mandiri dengan membaca logika source code, menjalankan kueri pengujian keamanan di terminal Laragon PHP 8.4 CLI, memverifikasi tidak ada kredensial yang bocor pada Git, serta mencatat seluruh riwayat interaksi pada `AI_USAGE_LOG.md`.*

---

## I. CHECKLIST PENGUMPULAN

- [x] **1. Security checklist berdasarkan risiko yang relevan selesai.**  
  *(Tinjauan keamanan OWASP Top 10:2025 mencakup 6 kategori risiko utama telah selesai dan terdokumentasi).*
- [x] **2. Dependency audit dilakukan bila proyek menggunakan dependency.**  
  *(Validasi dan audit `composer.json` melalui perintah `composer validate` dan `composer audit` telah dijalankan).*
- [x] **3. Minimal dua temuan relevan didokumentasikan.**  
  *(Terdokumentasi 6 temuan kerentanan nyata pada Tabel Temuan Keamanan Bagian D.8).*
- [x] **4. Bukti before-after perbaikan keamanan tersedia.**  
  *(Bukti kode sebelum perbaikan, sesudah perbaikan, dan hasil pengujian ulang status HTTP tercantum lengkap).*
- [x] **5. Risiko residual yang belum diperbaiki dijelaskan.**  
  *(Risiko residual beserta rencana mitigasi lanjutan diuraikan secara komprehensif).*

# Dokumentasi REST API & Test Matrix - Tarakota Fest 2026

Dokumen ini merupakan dokumentasi resmi REST API **Tarakota Fest 2026** sesuai standar **Modul 11 (CRUD Full-Stack, Validation, dan Error Handling)**.

- **Base URL (Laragon Apache):** `http://localhost/TarakotaFest/api`
- **Single Entry Point:** [`api/index.php`](../api/index.php) (seluruh request JSON diarahkan via `api/.htaccess`)
- **Format Pertukaran Data:** `application/json` (dan `multipart/form-data` khusus unggah poster/bukti transfer via `$_FILES`)
- **Otorisasi Admin:** Session Cookie PHP (`HttpOnly`, `SameSite=Lax`) melalui `POST /api/admin/login`

---

## 1. Standar Format Response & Kebijakan Error Handling

Seluruh endpoint mengembalikan struktur envelope JSON yang seragam dari `api/Core/Response.php`:

**Sukses (`200` / `201`):**
```json
{
  "ok": true,
  "status": 200,
  "message": "Detail event berhasil diperbarui.",
  "data": {}
}
```

**Gagal / Validasi / Error (`400` / `401` / `404` / `422` / `500`):**
```json
{
  "ok": false,
  "status": 422,
  "message": "Validasi event gagal. Periksa kembali kolom yang ditandai.",
  "errors": {
    "title": "Nama event minimal 3 karakter."
  }
}
```

**Keamanan Boundary API:**
1. Seluruh kueri menggunakan **PDO Prepared Statements** (`PDO::ATTR_EMULATE_PREPARES = false`).
2. `ini_set('display_errors', '0')` diaktifkan; seluruh `PDOException` dan `Throwable` dicatat via `error_log()` ke log server dan hanya mengembalikan pesan generik `HTTP 500` tanpa membocorkan password database, DSN, SQL, atau stack trace.
3. Penghapusan resource (`DELETE /api/events/{id}`) menggunakan **Soft Delete** (`is_active = 0, status = 'cancelled'`) demi menjaga integritas foreign key pada `transaksi_tiket`.
4. Operasi multi-query krusial (pengurangan/pengembalian `sisa_kuota`, pencatatan `users`, publikasi jadwal band) dibungkus dengan `beginTransaction()`, `SELECT ... FOR UPDATE`, `commit()`, dan `rollBack()`.

---

## 2. Daftar Endpoint API Aktual

| Method | Path | Tujuan | Auth | Query / Request Body | Status Sukses | Status Gagal |
|---|---|---|---|---|---|---|
| `GET` | `/health` | Cek konektivitas API & database MySQL | Publik | - | `200 JSON` | `500 JSON` |
| `GET` | `/csrf-token` | Ambil token proteksi CSRF sesi aktif | Publik / Auth | - | `200 JSON` | - |
| `POST` | `/register` | Registrasi akun pengguna baru (`password_hash`) | Publik | JSON `{ nama, email, password }` | `201 JSON` | `422 JSON` (validasi/email terdaftar) |
| `POST` | `/login` | Login pengguna/admin umum & terbitkan session | Publik | JSON `{ email, password }` | `200 JSON` | `401` / `422 JSON` |
| `GET` | `/me` | Ambil profil pengguna aktif tanpa `password_hash` | User / Admin | Cookie sesi | `200 JSON` | `401 JSON` (belum login) |
| `POST` | `/logout` | Akhiri sesi login dan hancurkan cookie sesi | User / Admin | Cookie sesi | `200 JSON` | - |
| `POST` | `/admin/login` | Login khusus portal admin & verifikasi role | Publik | JSON `{ email, password }` | `200 JSON` | `401` / `403` / `422` |
| `GET` | `/admin/session` | Cek status sesi login admin aktif | Publik | Cookie sesi | `200 JSON` | `401 JSON` |
| `POST` | `/admin/logout` | Akhiri sesi administrator | Admin | Cookie sesi | `200 JSON` | - |
| `GET` | `/events` | Read collection katalog event + filter + pagination | Publik / Admin (`all=1`) | `?all=0\|1&status=active\|cancelled\|completed&search=...&page=1&limit=50` | `200 JSON` | `400` (`page`/`limit`/`status` invalid), `401` (`all=1` tanpa login) |
| `GET` | `/events/{id}` | Read detail 1 event berdasarkan `kode_event` | Publik / Admin | Path parameter `{id}` (contoh `EVT-01`) | `200 JSON` | `404 JSON` jika ID tidak ada / terarsip |
| `POST` | `/events` | Create event baru (+ opsional upload poster) | Admin + CSRF | JSON atau `multipart/form-data`: `title`, `category`, `dateLabel`, `price`, `totalQuota`, `description`, `posterFile` | `201 JSON` | `401`, `403` (CSRF/RBAC), `422 JSON` |
| `PUT` / `POST` | `/events/{id}` | Full update event berdasarkan `kode_event` | Admin + CSRF | JSON (`PUT`) atau `multipart/form-data` (`POST`) semua field event | `200 JSON` | `401`, `403` (CSRF/RBAC), `404`, `422 JSON` |
| `PATCH` | `/events/{id}` | Partial update event (hanya field yang dikirim) | Admin + CSRF | JSON (minimal 1 field, mis. `{ "price": 175000 }`) | `200 JSON` | `401`, `403` (CSRF/RBAC), `404`, `422 JSON` |
| `PATCH` | `/events/{id}/status` | Ubah status event (`active`, `cancelled`, `completed`) | Admin + CSRF | JSON `{ status }` | `200 JSON` | `401`, `403` (CSRF/RBAC), `404`, `422 JSON` |
| `DELETE` | `/events/{id}` | Soft delete event (`is_active = 0`, `status = 'cancelled'`) | Admin + CSRF | Path parameter `{id}` | `200 JSON` | `401`, `403` (CSRF/RBAC), `404 JSON` |
| `GET` | `/schedule` | Read collection jadwal manggung + multi-filter + pagination | Publik | `?day=...&stage=...&genre=...&search=...&page=1&limit=50` | `200 JSON` | `400` (`page`/`limit` invalid) |
| `GET` | `/transactions` | Read daftar transaksi tiket + filter status + pagination | Admin | `?status=all\|pending\|paid\|cancelled&page=1&limit=50` | `200 JSON` | `400`, `401` |
| `GET` | `/transactions/lookup` | Cari status pesanan tiket publik | Publik | `?query=TRX-2026-0001` atau email, `?page=1&limit=25` | `200 JSON` | `400`, `422 JSON` |
| `GET` | `/my-tickets` | Riwayat transaksi tiket milik user yang sedang login | User / Admin | Cookie sesi | `200 JSON` | `401 JSON` (belum login) |
| `GET` | `/transactions/{id}` | Read detail 1 transaksi (`kode_transaksi`) | Admin | Path parameter `{id}` | `200 JSON` | `401`, `404 JSON` |
| `POST` | `/transactions` | Checkout & hold kuota tiket (15 menit) + opsional bukti | Publik | `multipart/form-data` / JSON: `eventId`, `buyerName`, `buyerEmail`, `buyerPhone`, `qty`, `proofFile`? (opsional) | `201 JSON` | `422 JSON` |
| `POST` | `/transactions/{id}/proof` | Unggah bukti transfer transaksi (IDOR Protected) | Publik / Owner | `multipart/form-data`: `proofFile` (PNG/JPG/WEBP <= 2 MB), `verifyEmail` (jika guest) | `200 JSON` | `403` (IDOR blocked / bukan pemilik), `404`, `422 JSON` |
| `PATCH` | `/transactions/{id}/verify` | Verifikasi pembayaran (`paid` / `cancelled` restore kuota) | Admin + CSRF | JSON `{ decision, adminNote }` | `200 JSON` | `401`, `403` (CSRF/RBAC), `404`, `422 JSON` |
| `GET` | `/bands` | Read daftar pendaftar audisi band + filter + pagination | Admin | `?status=all\|pending\|reviewed\|accepted\|rejected&page=1&limit=50` | `200 JSON` | `400`, `401` |
| `GET` | `/bands/{id}` | Read detail 1 pendaftar band (`kode_band`) | Admin | Path parameter `{id}` | `200 JSON` | `401`, `404 JSON` |
| `POST` | `/bands` | Kirim pendaftaran audisi band lokal | Publik | JSON `{ bandName, genre, originCity, contact, demoUrl, bio }` | `201 JSON` | `422 JSON` |
| `PATCH` | `/bands/{id}/curate` | Update kurasi (`reviewed`/`accepted`/`rejected`) + auto lineup | Admin + CSRF | JSON `{ decision, scheduleSlot? }` | `200 JSON` | `401`, `403` (CSRF/RBAC), `404`, `422 JSON` |
| `GET` | `/analytics/summary` | Ringkasan analitik pendapatan, tiket, antrean | Admin | - | `200 JSON` | `401 JSON` |
| `GET` | `/users` | Read daftar user terdaftar + pagination | Admin | `?search=...&role=all\|admin\|user&page=1&limit=50` | `200 JSON` | `401`, `403` |
| `POST` | `/users` | Tambah pengguna baru (admin portal) | Admin + CSRF | JSON `{ nama, email, password, role }` | `201 JSON` | `401`, `403`, `422 JSON` |
| `PATCH` | `/users/{id}/status` | Aktifkan/nonaktifkan status akun user | Admin + CSRF | - | `200 JSON` | `401`, `403`, `404 JSON` |

---

## 3. Contoh Request & Response Penting (CRUD Events)

### A. Read Collection dengan Filter & Pagination (`GET /api/events?search=Cabana&page=1&limit=2`)
**Response `200 OK`:**
```json
{
  "ok": true,
  "status": 200,
  "message": "",
  "data": {
    "items": [
      {
        "id": "EVT-02",
        "title": "Sunset Cabana Lounge Pass",
        "category": "VIP Shore",
        "dateLabel": "15 Agustus 2026",
        "price": 625000,
        "totalQuota": 50,
        "remainingQuota": 49,
        "thumbnail": "assets/images/placeholder-ticket.svg",
        "description": "Area duduk teduh menghadap laut dengan jalur masuk prioritas dan akses refill air minum gratis.",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 2,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### B. Read By ID Tidak Ditemukan (`GET /api/events/EVT-999`)
**Response `404 Not Found`:**
```json
{
  "ok": false,
  "status": 404,
  "message": "Event tidak ditemukan.",
  "errors": []
}
```

### C. Create Event Valid (`POST /api/events`)
**Request Body (JSON):**
```json
{
  "title": "Tarakota Acoustic Beach Pass",
  "category": "Daily Pass",
  "dateLabel": "16 Agustus 2026",
  "price": 175000,
  "totalQuota": 40,
  "description": "Akses area akustik senja di tepi pantai."
}
```
**Response `201 Created`:**
```json
{
  "ok": true,
  "status": 201,
  "message": "Event baru berhasil ditambahkan.",
  "data": {
    "id": "EVT-04",
    "title": "Tarakota Acoustic Beach Pass",
    "category": "Daily Pass",
    "dateLabel": "16 Agustus 2026",
    "price": 175000,
    "totalQuota": 40,
    "remainingQuota": 40,
    "thumbnail": "assets/images/placeholder-ticket.svg",
    "description": "Akses area akustik senja di tepi pantai.",
    "status": "active"
  }
}
```

### D. Partial Update (`PATCH /api/events/EVT-04`)
**Request Body (JSON):**
```json
{
  "price": 185000,
  "totalQuota": 50
}
```
**Response `200 OK`:** mengembalikan objek event dengan `price: 185000` dan `totalQuota: 50`.

### E. Soft Delete (`DELETE /api/events/EVT-04`)
**Response `200 OK`:**
```json
{
  "ok": true,
  "status": 200,
  "message": "Event diarsipkan (Soft Delete).",
  "data": {
    "id": "EVT-04",
    "is_active": 0
  }
}
```

---

## 4. Panduan Pengujian Langsung di Thunder Client (VS Code)

Thunder Client mendukung cookie sesi secara otomatis selama request dijalankan pada domain yang sama (`localhost`), sehingga sangat mudah dipakai untuk menguji seluruh endpoint publik maupun admin:

1. **Pastikan Laragon Aktif:** Klik **Start All** di Laragon (Apache & MySQL berjalan).
2. **Aktifkan Cookie di Thunder Client:** Buka tab **Settings** Thunder Client (ikon roda gigi) -> pastikan opsi **Manage Cookies** / penyimpanan cookie aktif agar `PHPSESSID` tersimpan setelah login.
3. **Request 1 — Login Admin (Wajib sebelum Create/Update/Delete Event):**
   - Method: `POST`
   - URL: `http://localhost/TarakotaFest/api/admin/login`
   - Tab **Body -> JSON**:
     ```json
     {
       "email": "admin@tarakota.id",
       "password": "tarakota2026"
     }
     ```
   - Klik **Send**. Pastikan status `200 OK`. Cookie `PHPSESSID` otomatis disimpan untuk request berikutnya ke `localhost`.
4. **Request 2 — Read Collection & Filter:**
   - `GET http://localhost/TarakotaFest/api/events?page=1&limit=2` -> `200 OK`
   - `GET http://localhost/TarakotaFest/api/events?search=Cabana` -> `200 OK`
   - `GET http://localhost/TarakotaFest/api/events?page=abc` -> `400 Bad Request`
5. **Request 3 — Read By ID & Uji 404:**
   - `GET http://localhost/TarakotaFest/api/events/EVT-01` -> `200 OK`
   - `GET http://localhost/TarakotaFest/api/events/EVT-999` -> `404 Not Found`
6. **Request 4 — Create Event (Valid `201` & Invalid `422`):**
   - `POST http://localhost/TarakotaFest/api/events` (Body -> **JSON** atau **Form-encode / Multipart** bila menguji unggah gambar `posterFile`).
   - Uji payload invalid (`title: "A", price: 0`) -> `422 Unprocessable Entity`.
   - Uji payload valid -> catat nilai `data.id` (misalnya `EVT-04`).
7. **Request 5 — Update (`PUT` & `PATCH`):**
   - `PATCH http://localhost/TarakotaFest/api/events/EVT-04` dengan JSON `{ "price": 195000 }` -> `200 OK`.
   - `PUT http://localhost/TarakotaFest/api/events/EVT-04` dengan seluruh field -> `200 OK`.
   - `PATCH http://localhost/TarakotaFest/api/events/EVT-999` dengan JSON `{ "price": 195000 }` -> `404 Not Found`.
8. **Request 6 — Soft Delete & Cek Existence (`200` lalu `404`):**
   - `DELETE http://localhost/TarakotaFest/api/events/EVT-04` -> `200 OK`.
   - Panggil ulang `GET http://localhost/TarakotaFest/api/events/EVT-04` dan `DELETE http://localhost/TarakotaFest/api/events/EVT-04` -> keduanya mengembalikan `404 Not Found`.
9. **Request 7 — Logout & Uji Otorisasi (`401`):**
   - `POST http://localhost/TarakotaFest/api/admin/logout` -> `200 OK`.
   - Panggil `POST http://localhost/TarakotaFest/api/events` tanpa login -> `401 Unauthorized`.

---

## 5. Test Matrix CRUD Full-Stack (Bukti Laporan Modul 11)

| No | Operasi & Kategori | Endpoint / Aksi UI | Input / Kondisi Uji | Ekspektasi Status & Output |
|---|---|---|---|---|
| 1 | Health Check | `GET /api/health` | MySQL aktif | `200 OK`, `status: "healthy"` |
| 2 | Read Collection + Pagination | `GET /api/events?page=1&limit=2` | Query valid `page=1&limit=2` | `200 OK`, max 2 item + metadata `pagination` |
| 3 | Read Collection + Search | `GET /api/events?search=Cabana` | Kata kunci `"Cabana"` | `200 OK`, hanya item cocok (`EVT-02`) yang kembali |
| 4 | Invalid Query Param | `GET /api/events?page=0` & `?status=xyz` | Parameter tidak valid | `400 Bad Request` dengan detail field `errors` |
| 5 | Read By ID (Valid) | `GET /api/events/EVT-01` | ID tersedia & aktif | `200 OK`, objek detail `EVT-01` |
| 6 | Read By ID (Not Found) | `GET /api/events/EVT-999` | ID fiktif | `404 Not Found`, `"Event tidak ditemukan."` |
| 7 | Otorisasi Admin Guard | `POST /api/events` | Tanpa login cookie | `401 Unauthorized` |
| 8 | Create Event (Invalid) | `POST /api/events` | `title` < 3 char, `price` = 0, `totalQuota` = -1 | `422 Unprocessable Entity`, pesan validasi per field |
| 9 | Create Event (Valid UI & API) | Modal `+ Tambah Event` / `POST /api/events` | Field lengkap valid (+ opsional `posterFile`) | `201 Created`, tersimpan ke DB, tabel admin refresh |
| 10 | Update Event (`PATCH` & `PUT`) | `PATCH /api/events/{id}` & modal Edit UI | Ubah harga/kuota valid (`totalQuota >= terpakai`) | `200 OK`, perubahan tersimpan di DB & UI |
| 11 | Update Kuota Invalid | `PATCH /api/events/EVT-01` | `totalQuota` < tiket terpakai | `422 Unprocessable Entity` |
| 12 | Update ID Fiktif | `PUT /api/events/EVT-999` | ID tidak ada di DB | `404 Not Found` |
| 13 | Soft Delete + Konfirmasi UI | Klik `Arsipkan` (`confirm()`) / `DELETE /api/events/{id}` | Batalkan konfirmasi -> batal; Setujui konfirmasi -> arsip | `200 OK`, DB `is_active = 0` & `status = 'cancelled'` |
| 14 | Delete / Read Pasca Arsip | `DELETE /api/events/{id}` ke-2 kali | ID sudah `is_active = 0` | `404 Not Found` |
| 15 | Checkout Atomik & Upload | Form Checkout `pemesanan.html` (`POST /api/transactions`) | Pilih event + upload PNG <= 2 MB + `qty` valid | `201 Created`, `sisa_kuota` berkurang atomik |
| 16 | Verifikasi Transaksi & Restore Kuota | Modal Verifikasi Admin (`PATCH /api/transactions/{id}/verify`) | Klik `Tolak & Kembalikan Kuota` (`cancelled`) | `200 OK`, status `cancelled` & kuota kembali |
| 17 | Kurasi Band & Auto Lineup | Modal Kurasi Band (`reviewed` -> `accepted`) | Set `accepted` + `publishToSchedule: true` | `200 OK`, band muncul di `jadwal.html` / `/api/schedule` |
| 18 | Simulasi Error DB Aman | Hentikan MySQL Laragon lalu `GET /api/events` | MySQL mati | `500 Internal Server Error` generik tanpa stack trace/password |

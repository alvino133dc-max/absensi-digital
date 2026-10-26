# HadirKu — Sistem Absensi Siswa

Aplikasi absensi siswa berbasis **HTML, CSS, JavaScript murni**, dan **Supabase**.
Aplikasi mencakup login, dashboard, pencatatan kehadiran, pembaruan data
real-time, validasi, serta pencegahan absensi ganda.

**Repository GitHub:** https://github.com/alvino133dc-max/absensi-digital

---

## 1. Kredensial Akun

Semua akun dibuat melalui **Supabase Authentication**. Aplikasi ini tidak
memiliki halaman registrasi; akun baru ditambahkan oleh administrator.

| Peran | Nama tampilan | Email | Password | Hak akses |
|---|---|---|---|---|
| **Admin** | Admin | `admin@absensiku.local` | `Admin123!` | Melihat semua data, menambah data, serta mengubah/menghapus **semua** data absensi. |
| **Pengguna biasa** | Alvino | `siswa@absensiku.local` | `Siswa123!` | Melihat semua data dan menambah data. Hanya dapat mengubah/menghapus **data miliknya sendiri**. |
| **Demo pemilik data** | Rizky | `demo@absensiku.local` | `Absensi123!` | Akun yang membuat data contoh. Hak aksesnya sama seperti pengguna biasa. |

> **Catatan peran admin:** peran disimpan di `app_metadata.role = "admin"`
> pada akun Supabase Auth, bukan di kode JavaScript. Nilai ini tidak dapat
> diubah oleh pengguna dari browser. Di UI, akun admin menampilkan badge
> **Admin** dan tombol ubah/hapus tersedia untuk semua baris.

---

## 2. Informasi Supabase

| Item | Nilai |
|---|---|
| Nama proyek | `absensi-siswa` |
| Project ref | `tnqczyytfuiambesjnun` |
| Project URL | `https://tnqczyytfuiambesjnun.supabase.co` |
| Tabel utama | `public.absensi` |
| Konfigurasi client | `js/config.js` |
| Publishable key | `sb_publishable_u5mwN3HkuFgNkoAuZMKj6g_2Bg2fZJL` |

Publishable key aman dipakai di browser karena seluruh akses data dilindungi
**Row Level Security (RLS)**. Jangan pernah menaruh `service_role` key atau
secret key di file frontend.

---

## 3. Fitur

- Login email/password dengan Supabase Auth.
- Proteksi halaman dashboard: pengguna yang belum login diarahkan ke halaman login.
- Logout dan pembersihan sesi.
- Dashboard menampilkan nama pengguna yang sedang login.
- Statistik total absensi, Hadir, Izin, dan Sakit.
- Form absensi: `nama`, `kelas`, `tanggal`, dan `status` (Hadir/Izin/Sakit).
- Validasi sisi client: nama, kelas, tanggal, dan status wajib diisi.
- Pencegahan absensi ganda untuk siswa + kelas + tanggal yang sama:
  - pengecekan awal di client;
  - unique index di database sebagai pengaman terakhir.
- Tabel data real-time melalui Supabase Realtime.
- Pencarian nama/kelas dan filter status.
- Ubah dan hapus data (pemilik data atau admin).
- Notifikasi sukses/gagal dan dialog konfirmasi hapus.
- Tampilan responsif untuk desktop dan mobile.

---

## 4. Struktur Folder

```text
absensi-siswa/
├── index.html                  # Halaman login
├── dashboard.html              # Dashboard + form + tabel
├── css/
│   └── style.css               # Seluruh styling dan media query
├── js/
│   ├── config.js               # URL dan publishable key Supabase
│   ├── supabase-client.js      # Inisialisasi client Supabase
│   ├── utils.js                # Escape HTML, format tanggal, inisial
│   ├── login.js                # Logika login dan pesan error
│   └── dashboard.js            # Auth guard, CRUD, validasi, realtime
├── assets/
│   └── favicon.svg
├── supabase/
│   └── schema.sql              # Tabel, index, RLS, grant, realtime
├── screenshots/
│   ├── login.png
│   ├── dashboard.png
│   ├── dashboard-delete-dialog.png
│   ├── login-after-logout.png
│   ├── supabase.png            # Daftar akun di Supabase Auth
│   └── supabase-table.png      # Skema tabel public.absensi
└── README.md
```

---

## 5. Cara Menjalankan

Aplikasi adalah situs statis, jadi cukup dijalankan dengan web server lokal.

### Opsi A — Python

```bash
cd absensi-siswa
python -m http.server 8000
```

Buka `http://localhost:8000` (atau `http://127.0.0.1:8000`).

### Opsi B — VS Code Live Server

1. Buka folder `absensi-siswa` di VS Code.
2. Klik kanan `index.html` → **Open with Live Server**.

### Login

Gunakan salah satu akun pada bagian **Kredensial Akun** di atas.

> Jangan membuka `index.html` langsung lewat `file://`, karena beberapa browser
> membatasi penyimpanan sesi dan permintaan jaringan pada protokol tersebut.

---

## 6. Setup Database

1. Buka **Supabase Dashboard → SQL Editor → New query**.
2. Salin seluruh isi `supabase/schema.sql`, lalu klik **Run**.
3. Buat akun lewat **Authentication → Users** (atau gunakan akun yang sudah ada).
4. Pastikan tabel `public.absensi` sudah masuk publication `supabase_realtime`
   (sudah ditangani oleh `schema.sql`).

### Menjadikan sebuah akun sebagai admin

Jalankan SQL berikut, ganti email sesuai kebutuhan:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
  updated_at = now()
where email = 'admin@absensiku.local';
```

Pengguna perlu login ulang agar JWT baru memuat `app_metadata.role = "admin"`.

### Skema tabel

```sql
create table public.absensi (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  kelas       text not null,
  tanggal     date not null,
  status      text not null,
  uid         uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  "createdAt" timestamptz not null default now(),

  constraint absensi_nama_tidak_kosong
    check (char_length(btrim(nama)) between 1 and 100),
  constraint absensi_kelas_tidak_kosong
    check (char_length(btrim(kelas)) between 1 and 50),
  constraint absensi_status_valid
    check (status in ('Hadir', 'Izin', 'Sakit'))
);
```

### Index penting

```sql
-- Mempercepat pengurutan data terbaru
create index absensi_tanggal_idx
  on public.absensi (tanggal desc, "createdAt" desc);

-- Pencegahan absensi ganda (case-insensitive, spasi dirapikan)
create unique index absensi_unik_siswa_tanggal_idx
  on public.absensi (lower(btrim(nama)), lower(btrim(kelas)), tanggal);
```

---

## 7. Row Level Security (RLS)

RLS diaktifkan pada tabel `absensi`:

| Operasi | Policy | Aturan |
|---|---|---|
| `SELECT` | Pengguna login dapat melihat absensi | Semua pengguna `authenticated` boleh membaca semua data. |
| `INSERT` | Pengguna dapat menambah absensi sendiri | `auth.uid() = uid`; kolom `uid` otomatis terisi dari token login. |
| `UPDATE` | Pengguna dapat mengubah absensi sendiri | Pemilik data **atau** admin. |
| `DELETE` | Pengguna dapat menghapus absensi sendiri | Pemilik data **atau** admin. |

Fungsi bantu admin:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
```

Pengunjung tanpa login (`anon`) tidak memiliki grant apa pun ke tabel.
Hak `TRUNCATE`, `REFERENCES`, dan `TRIGGER` untuk `authenticated` juga dicabut
karena `TRUNCATE` tidak dilindungi RLS.

---

## 8. Alur Aplikasi

1. **Login** — `js/login.js` memanggil `supabase.auth.signInWithPassword()`.
   Jika berhasil, pengguna diarahkan ke `dashboard.html`.
2. **Auth guard** — `js/dashboard.js` memanggil `getSession()` dan `getUser()`
   sebelum menampilkan dashboard. Jika tidak ada sesi, pengguna dikembalikan
   ke halaman login dengan pesan yang sesuai.
3. **Membaca data** — data diambil dari `public.absensi` dengan urutan tanggal
   terbaru, lalu dirender ke tabel dan kartu statistik.
4. **Menyimpan data** — form divalidasi, duplikat dicek, lalu data di-`insert`
   ke Supabase. Jika unique index menolak, muncul pesan absensi ganda.
5. **Mengubah/menghapus** — hanya pemilik data atau admin yang melihat tombol
   aksi. RLS di database tetap menjadi pengaman utama.
6. **Realtime** — channel `postgres_changes` berlangganan ke tabel `absensi`.
   Setiap INSERT/UPDATE/DELETE memicu pemuatan ulang data secara otomatis.
7. **Logout** — `supabase.auth.signOut()` menghapus sesi dan mengembalikan
   pengguna ke halaman login.

---

## 9. Validasi dan Pencegahan Duplikat

Validasi di `js/dashboard.js`:

- Nama wajib diisi, maksimal 100 karakter.
- Kelas wajib diisi, maksimal 50 karakter.
- Tanggal wajib dipilih dan formatnya valid.
- Status wajib dipilih (Hadir/Izin/Sakit).
- Spasi berlebih pada nama/kelas dirapikan sebelum disimpan.

Pencegahan duplikat dilakukan dua lapis:

1. **Client** — mencari data dengan tanggal yang sama, lalu membandingkan
   nama dan kelas tanpa membedakan huruf besar/kecil.
2. **Database** — unique index
   `(lower(btrim(nama)), lower(btrim(kelas)), tanggal)`.
   Pelanggaran menghasilkan error PostgreSQL `23505` yang ditangkap dan
   ditampilkan sebagai pesan yang ramah.

---

## 10. Hasil Pengujian

Pengujian dilakukan dengan **Chrome headless + Chrome DevTools Protocol (CDP)**,
tanpa Playwright.

| Skenario | Hasil |
|---|---|
| Login dengan password salah | Lulus — pesan “Email atau password salah.” |
| Login dengan kredensial benar | Lulus — diarahkan ke dashboard |
| Dashboard menampilkan nama/email pengguna | Lulus |
| Form kosong | Lulus — validasi nama, kelas, tanggal, status |
| Absensi ganda | Lulus — ditolak dengan pesan jelas |
| Simpan absensi baru | Lulus — data masuk ke Supabase |
| Ubah absensi | Lulus — status berubah dan tabel diperbarui |
| Hapus absensi | Lulus — dialog konfirmasi dan data terhapus |
| Logout | Lulus — sesi berakhir, kembali ke login |
| Akses dashboard tanpa login | Lulus — diarahkan ke login |
| Realtime | Lulus — indikator berubah menjadi **Live** |
| RLS admin vs pengguna biasa | Lulus — admin dapat mengubah data orang lain; pengguna biasa tidak |

Pengujian REST juga memastikan:

- insert tanpa login ditolak (`401`);
- absensi ganda ditolak (`409`, kode `23505`);
- pengguna biasa tidak dapat mengubah data milik akun lain (0 baris terpengaruh);
- admin dapat mengubah data milik akun lain.

---

## 11. Screenshot

| File | Keterangan |
|---|---|
| `screenshots/login.png` | Halaman login |
| `screenshots/dashboard.png` | Dashboard, statistik, form, dan tabel |
| `screenshots/dashboard-delete-dialog.png` | Dialog konfirmasi hapus |
| `screenshots/login-after-logout.png` | Halaman login setelah logout |
| `screenshots/supabase.png` | Daftar akun di Supabase Authentication |
| `screenshots/supabase-table.png` | Skema tabel `public.absensi` di Supabase |

---

## 12. Catatan Keamanan

- Hanya **publishable key** yang ada di frontend; tidak ada secret key.
- RLS aktif dan diuji untuk SELECT, INSERT, UPDATE, dan DELETE.
- `uid` diisi otomatis dari `auth.uid()`, bukan dari input pengguna.
- Nama dan kelas di-escape sebelum dirender ke HTML untuk mencegah XSS.
- Error database tidak ditampilkan mentah-mentah ke pengguna.
- Akun demo sebaiknya diganti atau dinonaktifkan sebelum proyek dipakai
  di lingkungan nyata.
- Jika repository GitHub bersifat publik, pertimbangkan untuk tidak
  menampilkan password akun demo atau email pribadi pada screenshot.

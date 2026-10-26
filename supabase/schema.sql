-- ============================================================
-- HadirKu - Sistem Absensi Siswa
-- Skema database Supabase
-- ------------------------------------------------------------
-- Project : absensi-siswa
-- Ref     : tnqczyytfuiambesjnun
-- URL     : https://tnqczyytfuiambesjnun.supabase.co
--
-- Cara pakai:
--   1. Buka Supabase Dashboard > SQL Editor > New query.
--   2. Tempel seluruh isi file ini, lalu klik Run.
--   3. Buat akun login lewat menu Authentication > Users
--      (aplikasi ini tidak memiliki halaman registrasi).
--
-- File ini idempoten: aman dijalankan ulang.
-- ============================================================

-- gen_random_uuid() tersedia dari ekstensi pgcrypto.
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1. Tabel absensi
-- ------------------------------------------------------------
create table if not exists public.absensi (
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

comment on table public.absensi is
  'Data kehadiran siswa. Satu siswa (nama + kelas) hanya boleh memiliki satu absensi per tanggal.';

-- ------------------------------------------------------------
-- 2. Index
-- ------------------------------------------------------------
-- Mempercepat pengurutan data terbaru di dashboard.
create index if not exists absensi_tanggal_idx
  on public.absensi (tanggal desc, "createdAt" desc);

-- Mempercepat pengecekan kepemilikan data (RLS) dan query per pengguna.
create index if not exists absensi_uid_idx
  on public.absensi (uid);

-- Pencegahan absensi ganda di level database.
-- Nama dan kelas dibandingkan tanpa spasi berlebih dan tanpa
-- membedakan huruf besar/kecil.
create unique index if not exists absensi_unik_siswa_tanggal_idx
  on public.absensi (lower(btrim(nama)), lower(btrim(kelas)), tanggal);

-- ------------------------------------------------------------
-- 3. Row Level Security (RLS)
-- ------------------------------------------------------------
alter table public.absensi enable row level security;

-- Fungsi bantu untuk mengecek peran admin. Peran disimpan di
-- app_metadata JWT sehingga tidak dapat diubah sendiri oleh pengguna.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

comment on function public.is_admin() is
  'Mengembalikan true jika pengguna memiliki role admin pada app_metadata JWT.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Semua pengguna yang sudah login boleh membaca data absensi.
drop policy if exists "Pengguna login dapat melihat absensi" on public.absensi;
create policy "Pengguna login dapat melihat absensi"
  on public.absensi
  for select
  to authenticated
  using (true);

-- Pengguna hanya boleh menambah data atas namanya sendiri.
-- Kolom uid otomatis diisi auth.uid() sehingga tidak bisa dipalsukan.
drop policy if exists "Pengguna dapat menambah absensi sendiri" on public.absensi;
create policy "Pengguna dapat menambah absensi sendiri"
  on public.absensi
  for insert
  to authenticated
  with check ((select auth.uid()) = uid);

-- Pengguna biasa hanya boleh mengubah data miliknya sendiri.
-- Admin boleh mengubah semua data.
drop policy if exists "Pengguna dapat mengubah absensi sendiri" on public.absensi;
create policy "Pengguna dapat mengubah absensi sendiri"
  on public.absensi
  for update
  to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()))
  with check ((select auth.uid()) = uid or (select public.is_admin()));

-- Pengguna biasa hanya boleh menghapus data miliknya sendiri.
-- Admin boleh menghapus semua data.
drop policy if exists "Pengguna dapat menghapus absensi sendiri" on public.absensi;
create policy "Pengguna dapat menghapus absensi sendiri"
  on public.absensi
  for delete
  to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()));

-- ------------------------------------------------------------
-- 4. Hak akses (grant)
-- ------------------------------------------------------------
-- Pengunjung tanpa login tidak memiliki akses sama sekali.
revoke all on public.absensi from anon;

-- Pengguna login hanya membutuhkan operasi CRUD dasar.
grant select, insert, update, delete on public.absensi to authenticated;

-- TRUNCATE tidak dilindungi RLS, jadi cabut agar tidak disalahgunakan.
revoke truncate, references, trigger on public.absensi from authenticated;

-- ------------------------------------------------------------
-- 5. Realtime
-- ------------------------------------------------------------
-- Tambahkan tabel ke publication realtime Supabase agar perubahan
-- data langsung dikirim ke dashboard (INSERT/UPDATE/DELETE).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'absensi'
  ) then
    alter publication supabase_realtime add table public.absensi;
  end if;
end
$$;

-- ------------------------------------------------------------
-- 6. Verifikasi
-- ------------------------------------------------------------
-- Tabel, RLS, index, dan policy dapat dicek dengan query berikut:
--
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'absensi'
-- order by ordinal_position;
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public' and tablename = 'absensi';
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'absensi'
-- order by policyname;
--
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'absensi';

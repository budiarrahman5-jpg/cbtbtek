-- ==============================================================================
-- DATABASE MASTER CBT B-TEK (SUPABASE / POSTGRESQL) - TERLENGKAP & DIPERBAHARUI
-- ==============================================================================
-- Keterangan:
-- Script ini berisi skema lengkap, relasi foreign key, indeks performa,
-- izin GRANT akses (anon & authenticated), penanganan Row Level Security (RLS),
-- konfigurasi Supabase Realtime, serta data default (Admin, Pengaturan, Notifikasi).
-- Sangat aman digunakan untuk KLIEN (Fresh Install maupun Update database lama).
-- ==============================================================================

-- 0. AKTIFKAN EXTENSION UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABEL KELAS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kelas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_kelas TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. TABEL PAKET (Paket Ujian)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.paket (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_paket TEXT NOT NULL,
    deskripsi TEXT,
    durasi_menit INTEGER DEFAULT 60,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif', 'Diarsipkan')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. TABEL USERS (Admin & Siswa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nama TEXT NOT NULL,
    kelas_id UUID REFERENCES public.kelas(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'siswa' CHECK (role IN ('admin', 'siswa')),
    status_login TEXT DEFAULT '0' CHECK (status_login IN ('0', '1')),
    status_ujian TEXT DEFAULT 'Belum Ujian',
    jawaban_sementara JSONB DEFAULT '{}'::jsonb,
    sisa_waktu INTEGER DEFAULT 0,
    paket_aktif_id UUID REFERENCES public.paket(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Penyesuaian jika database lama belum memiliki kolom-kolom baru:
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status_login TEXT DEFAULT '0' CHECK (status_login IN ('0', '1'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status_ujian TEXT DEFAULT 'Belum Ujian';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS jawaban_sementara JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sisa_waktu INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paket_aktif_id UUID REFERENCES public.paket(id) ON DELETE SET NULL;

-- ==============================================================================
-- 4. TABEL SOAL (Bank Soal)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.soal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipe TEXT NOT NULL CHECK (tipe IN ('PG', 'PG Kompleks', 'Isian', 'Essay', 'Menjodohkan')),
    pertanyaan TEXT NOT NULL,
    opsi_a TEXT,
    opsi_b TEXT,
    opsi_c TEXT,
    opsi_d TEXT,
    opsi_e TEXT,
    kunci TEXT,
    skor_maks INTEGER DEFAULT 10,
    gambar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. TABEL PAKET_SOAL (Relasi Many-to-Many Paket <-> Soal)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.paket_soal (
    paket_id UUID REFERENCES public.paket(id) ON DELETE CASCADE,
    soal_id UUID REFERENCES public.soal(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (paket_id, soal_id)
);

-- ==============================================================================
-- 6. TABEL HASIL (Hasil & Nilai Ujian Siswa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hasil (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    paket_id UUID REFERENCES public.paket(id) ON DELETE CASCADE,
    skor_akhir FLOAT DEFAULT 0,
    waktu_sisa INTEGER DEFAULT 0,
    cheat_count INTEGER DEFAULT 0,
    detail_jawaban JSONB DEFAULT '{}'::jsonb,
    status_koreksi TEXT DEFAULT 'Selesai' CHECK (status_koreksi IN ('Selesai', 'Menunggu Koreksi')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.hasil ADD COLUMN IF NOT EXISTS cheat_count INTEGER DEFAULT 0;
ALTER TABLE public.hasil ADD COLUMN IF NOT EXISTS detail_jawaban JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.hasil ADD COLUMN IF NOT EXISTS status_koreksi TEXT DEFAULT 'Selesai';

-- ==============================================================================
-- 7. TABEL JAWABAN (Rincian Jawaban Siswa & Koreksi AI Essay/Isian)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jawaban (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hasil_id UUID REFERENCES public.hasil(id) ON DELETE CASCADE,
    soal_id UUID REFERENCES public.soal(id) ON DELETE CASCADE,
    jawaban_teks TEXT,
    skor FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 8. TABEL NOTIFIKASI (Pengumuman & Update Sistem)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id TEXT PRIMARY KEY,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    tanggal TEXT,
    dibaca BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifikasi ADD COLUMN IF NOT EXISTS dibaca BOOLEAN DEFAULT false;

-- ==============================================================================
-- 9. TABEL PENGATURAN (Konfigurasi Aplikasi & Kunci API)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pengaturan (
    kunci TEXT PRIMARY KEY,
    nilai TEXT NOT NULL
);

-- ==============================================================================
-- 10. TABEL LOG (Log Aktivitas Pengguna)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    aktivitas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 11. INDEKS PERFORMA (Cepat & Kuat Saat Ujian Massal Ratusan Siswa)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_kelas ON public.users(kelas_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status_login ON public.users(status_login);
CREATE INDEX IF NOT EXISTS idx_paket_status ON public.paket(status);
CREATE INDEX IF NOT EXISTS idx_paket_soal_paket ON public.paket_soal(paket_id);
CREATE INDEX IF NOT EXISTS idx_paket_soal_soal ON public.paket_soal(soal_id);
CREATE INDEX IF NOT EXISTS idx_hasil_user ON public.hasil(user_id);
CREATE INDEX IF NOT EXISTS idx_hasil_paket ON public.hasil(paket_id);
CREATE INDEX IF NOT EXISTS idx_hasil_user_paket ON public.hasil(user_id, paket_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_hasil ON public.jawaban(hasil_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_soal ON public.jawaban(soal_id);
CREATE INDEX IF NOT EXISTS idx_log_user ON public.log(user_id);
CREATE INDEX IF NOT EXISTS idx_notifikasi_created ON public.notifikasi(created_at DESC);

-- ==============================================================================
-- 12. PEMBERIAN HAK AKSES PERMISSION (ANTI PERMISSION DENIED)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) ANTI ERROR
-- ==============================================================================
-- Nonaktifkan RLS agar Supabase anon key di frontend dapat membaca dan menyimpan ujian
ALTER TABLE public.kelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.paket DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.paket_soal DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hasil DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengaturan DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.log DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 14. FITUR SUPABASE REALTIME (Untuk Pantau Siswa & Pembaruan Langsung)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hasil;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.log;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifikasi;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

-- ==============================================================================
-- 15. DATA DEFAULT (Seed Initial Data)
-- ==============================================================================

-- 15.1 Akun Admin Default (Jika belum ada)
INSERT INTO public.users (username, password, nama, role) 
VALUES ('admin', 'admin123', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 15.2 Master Pengaturan Sistem (Lengkap v4.2 - Multi-Provider AI & Exambro)
INSERT INTO public.pengaturan (kunci, nilai) VALUES
('nama_aplikasi', 'CBT B-TEK - Ujian Online'),
('logo_aplikasi', '/logo.png'),
('tampil_nilai', 'ON'),
('mode_review', 'OFF'),
('acak_soal', 'ON'),
('acak_opsi', 'ON'),
('nilai_kkm', '75'),
('proteksi_layar', 'ON'),
('kode_buka_blokir', 'BUKA123'),
('proteksi_siswa_list', '[]'),
('exambro_keywords', 'exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt'),
('groq_api_key', ''),
('gemini_api_key', ''),
('ai_provider', 'auto')
ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai WHERE public.pengaturan.nilai IS NULL;

-- 15.3 Notifikasi Sambutan Default
INSERT INTO public.notifikasi (id, judul, pesan, tanggal, dibaca) VALUES
(
    'pengumuman-001',
    'Selamat Datang di Sistem Notifikasi B-TEK',
    'Halo Bapak/Ibu Admin Sekolah, sistem CBT B-TEK telah siap digunakan. Seluruh modul ujian, proteksi layar, dan koreksi AI siap berjalan.',
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    false
)
ON CONFLICT (id) DO NOTHING;

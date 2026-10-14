# 📊 Panduan Setup Supabase untuk Article Click Tracking

## 🚀 Langkah 1: Setup Supabase Project

### 1.1 Buat Akun Supabase
1. Kunjungi [https://supabase.com](https://supabase.com)
2. Klik "Start your project" atau "Sign Up"
3. Daftar menggunakan GitHub, Google, atau email

### 1.2 Buat Project Baru
1. Setelah login, klik "New Project"
2. Pilih organization (atau buat baru)
3. Isi detail project:
   - **Name**: `chatbot-article-tracking` (atau nama sesuai keinginan)
   - **Database Password**: Buat password yang kuat (SIMPAN PASSWORD INI!)
   - **Region**: Pilih yang terdekat dengan lokasi Anda
4. Klik "Create new project"
5. Tunggu beberapa menit hingga project selesai dibuat

## 🗄️ Langkah 2: Setup Database

### 2.1 Akses SQL Editor
1. Di dashboard Supabase, klik menu "SQL Editor" di sidebar kiri
2. Klik "New Query" untuk membuat query baru

### 2.2 Jalankan Skrip SQL Berikut

Copy dan paste skrip SQL berikut ke SQL Editor, lalu klik "Run":

```sql
-- Buat tabel untuk tracking klik artikel
CREATE TABLE IF NOT EXISTS article_clicks (
  id BIGSERIAL PRIMARY KEY,
  article_url TEXT NOT NULL,
  article_title TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT,
  user_agent TEXT,
  referrer_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buat index untuk performa query yang lebih baik
CREATE INDEX IF NOT EXISTS idx_article_clicks_url ON article_clicks(article_url);
CREATE INDEX IF NOT EXISTS idx_article_clicks_clicked_at ON article_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_article_clicks_session_id ON article_clicks(session_id);

-- Buat view untuk analytics (opsional)
CREATE OR REPLACE VIEW article_click_stats AS
SELECT 
  article_url,
  article_title,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT session_id) as unique_sessions,
  DATE_TRUNC('day', clicked_at) as click_date,
  MIN(clicked_at) as first_click,
  MAX(clicked_at) as last_click
FROM article_clicks 
GROUP BY article_url, article_title, DATE_TRUNC('day', clicked_at)
ORDER BY total_clicks DESC;

-- Enable Row Level Security (RLS) untuk keamanan.
-- Sengaja TIDAK ada policy untuk anon/authenticated: semua insert dilakukan
-- server lewat service role key (yang otomatis melewati RLS), sehingga data
-- klik tidak bisa dibaca atau ditulis langsung dari browser.
ALTER TABLE article_clicks ENABLE ROW LEVEL SECURITY;

-- View analytics hanya untuk service role
REVOKE ALL ON article_click_stats FROM anon, authenticated;
```

### 2.3 Sudah pernah menjalankan versi lama skrip ini?
Versi lama membuat policy yang membuka tabel untuk publik. Jalankan ini untuk menutupnya:

```sql
DROP POLICY IF EXISTS "Allow insert article clicks" ON article_clicks;
DROP POLICY IF EXISTS "Allow select article clicks" ON article_clicks;
REVOKE ALL ON article_click_stats FROM anon, authenticated;
```

### 2.4 Verifikasi Tabel
Setelah menjalankan skrip, verifikasi bahwa tabel berhasil dibuat:
1. Klik menu "Table Editor" di sidebar
2. Anda harus melihat tabel `article_clicks` dalam daftar
3. Klik tabel tersebut untuk melihat struktur kolom

## 🔑 Langkah 3: Dapatkan API Keys

### 3.1 Akses Project Settings
1. Klik ikon "Settings" (gear) di sidebar kiri
2. Pilih "API" dari menu settings

### 3.2 Copy API Keys
Anda akan melihat beberapa informasi penting:

- **Project URL**: `https://your-project-id.supabase.co`
- **anon/public key**: Key yang dimulai dengan `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key**: Key rahasia (jangan expose ke frontend)

**PENTING**: Copy dan simpan kedua informasi ini dengan aman!

## 📝 Langkah 4: Environment Variables

Buat file `.env.local` di root project Anda (jika belum ada) dan tambahkan:

```env
# Supabase Configuration (server-side saja)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Ganti**:
- `your-project-id` dengan Project URL Anda
- `your-service-role-key-here` dengan service role key Anda

## ✅ Langkah 5: Verifikasi Setup

### 5.1 Test Koneksi (Opsional)
Anda bisa test koneksi dengan menjalankan query sederhana di SQL Editor:

```sql
-- Test insert data
INSERT INTO article_clicks (article_url, article_title, session_id) 
VALUES ('https://example.com/test', 'Test Article', 'test-session-123');

-- Test select data
SELECT * FROM article_clicks ORDER BY created_at DESC LIMIT 5;

-- Hapus test data
DELETE FROM article_clicks WHERE session_id = 'test-session-123';
```

## 🔒 Keamanan

- ✅ Row Level Security (RLS) sudah diaktifkan
- ✅ Tidak ada policy publik: browser tidak bisa membaca/menulis tabel langsung
- ✅ Tidak ada key Supabase yang di-expose ke frontend
- ✅ Service role key disimpan di server-side saja, insert lewat `/api/track-click`
- ✅ Endpoint hanya menerima URL artikel yang ada di `news.json`, dengan rate limit per IP

## 📊 Bonus: Query Analytics

Beberapa query berguna untuk analytics:

```sql
-- Top 10 artikel paling populer
SELECT article_url, article_title, COUNT(*) as clicks
FROM article_clicks 
GROUP BY article_url, article_title 
ORDER BY clicks DESC 
LIMIT 10;

-- Klik per hari dalam 7 hari terakhir
SELECT 
  DATE_TRUNC('day', clicked_at) as date,
  COUNT(*) as total_clicks
FROM article_clicks 
WHERE clicked_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', clicked_at)
ORDER BY date;

-- Unique sessions per artikel
SELECT 
  article_url,
  COUNT(DISTINCT session_id) as unique_visitors,
  COUNT(*) as total_clicks
FROM article_clicks 
GROUP BY article_url
ORDER BY unique_visitors DESC;
```

---

## 🎯 Selanjutnya

Setelah setup Supabase selesai, langkah berikutnya adalah:
1. Install dependencies Supabase di project
2. Setup Supabase client
3. Buat API endpoint untuk tracking
4. Implementasi click handler di frontend

**CATATAN**: Pastikan Anda sudah menyimpan semua credentials dengan aman sebelum melanjutkan!
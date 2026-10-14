# Chatbot Berita Kompas.id

Chatbot yang menjawab pertanyaan berdasarkan berita di Kompas.id.

## Cara Mengubah Konten Berita

Untuk mengubah konten berita yang digunakan oleh chatbot, Anda perlu mengedit file `news.json` di root project. File ini berisi array artikel berita dengan format berikut:

\`\`\`json
[
  {
    "url": "URL artikel",
    "published_at": 45786, // Timestamp publikasi
    "title": "Judul artikel",
    "full_text": "Teks lengkap artikel"
  },
  // Artikel lainnya...
]
\`\`\`

Setiap artikel harus memiliki properti berikut:
- `url`: URL artikel asli
- `published_at`: Timestamp publikasi (opsional)
- `title`: Judul artikel
- `full_text`: Teks lengkap artikel

## Cara Mengubah Contoh Pertanyaan

Untuk mengubah contoh pertanyaan yang ditampilkan di chatbot, Anda perlu mengedit file `questions.json` di root project. File ini berisi array pertanyaan dengan format berikut:

```json
[
  {
    "questions": "Pertanyaan contoh 1?"
  },
  {
    "questions": "Pertanyaan contoh 2?"
  },
  // Pertanyaan lainnya...
]
```

Setiap pertanyaan harus memiliki properti:
- `questions`: Teks pertanyaan yang akan ditampilkan sebagai contoh

## Cara Mengubah Judul dan Subjudul Chatbot

Untuk mengubah judul dan subjudul yang ditampilkan di halaman utama chatbot, Anda perlu mengedit file `title.json` di root project. File ini berisi array dengan format berikut:

```json
[
  {
    "title": "Judul Chatbot",
    "subtitle": "Deskripsi atau subjudul chatbot"
  }
]
```

Setiap objek harus memiliki properti:
- `title`: Judul utama yang ditampilkan di chatbot
- `subtitle`: Subjudul atau deskripsi yang ditampilkan di bawah judul

**Catatan**: Chatbot akan menggunakan objek pertama dalam array. Jika file tidak ditemukan atau terjadi error, chatbot akan menggunakan nilai default yang sudah di-hardcode.

## Proses Chunking dan Embedding Otomatis

Chatbot ini menggunakan sistem chunking dan embedding otomatis untuk memproses konten berita:

### 🔄 Proses Otomatis
- **Chunking**: Artikel dipecah menjadi chunks berukuran 800 karakter dengan overlap 100 karakter
- **Embedding**: Setiap chunk diproses menggunakan OpenAI text-embedding-3-small model
- **Build-time Processing**: Script `prepare-embeddings.js` dijalankan otomatis saat build
- **Output**: Hasil disimpan di `data/chunks.json` dan `data/embeddings.json`

### 📋 Konfigurasi Environment Variables
Untuk menjalankan proses embedding, diperlukan environment variable:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 🚀 Deploy ke Vercel
1. Fork repository ini
2. Ubah file `news.json`, `title.json`, dan `questions.json` sesuai kebutuhan
3. Set environment variable `OPENAI_API_KEY` di Vercel dashboard
4. Deploy - proses chunking dan embedding akan berjalan otomatis!

## Tracking Analytics dengan Supabase (Opsional)

Chatbot mendukung tracking interaksi pengguna menggunakan Supabase:

### 📊 Data yang Ditrack
- URL artikel yang diklik
- Judul artikel
- Session ID pengguna
- User agent
- Referrer message ID
- Timestamp interaksi

### 🗄️ Setup Database
1. Buat project baru di Supabase
2. Jalankan SQL script yang ada di `SUPABASE_SETUP.md`
3. Set environment variables di Vercel:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

**Catatan**: Tracking bersifat opsional. Jika environment variables Supabase tidak diset, chatbot tetap berfungsi normal tanpa tracking.

## Cara Menggunakan Embed

Untuk menyematkan chatbot di website lain, gunakan kode iframe berikut:

```html
<iframe 
  src="https://chatbot-contoh.vercel.app/?embed=true" 
  width="100%" 
  height="600" 
  style="border: 1px solid #ddd; border-radius: 8px;" 
  allow="clipboard-write"
></iframe>


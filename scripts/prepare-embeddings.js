require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Konfigurasi
const CHUNK_SIZE = 800; // Target size per chunk
const OVERLAP_SIZE = 100; // Overlap antar chunk
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 64; // Jumlah chunk per request embedding

const ROOT = path.join(__dirname, '..');
const NEWS_PATH = path.join(ROOT, 'news.json');
const DATA_DIR = path.join(ROOT, 'data');
const CHUNKS_PATH = path.join(DATA_DIR, 'chunks.json');
const EMBEDDINGS_PATH = path.join(DATA_DIR, 'embeddings.json');

// Fungsi untuk split text menjadi chunks
function splitIntoChunks(text, maxSize = CHUNK_SIZE, overlap = OVERLAP_SIZE) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // Jika tidak sampai akhir text, cari titik potong yang baik
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const lastSpace = text.lastIndexOf(' ', end);

      const cutPoint = Math.max(lastPeriod, lastNewline, lastSpace);
      if (cutPoint > start + maxSize * 0.5) {
        end = cutPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Set start untuk chunk berikutnya dengan overlap
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

const hashText = (text) =>
  crypto.createHash('sha256').update(`${EMBEDDING_MODEL}\n${text}`).digest('hex');

// Generate embedding untuk banyak teks sekaligus
async function generateEmbeddings(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// Kompatibilitas: generate embedding untuk satu teks
async function generateEmbedding(text) {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

// Muat embedding lama sebagai cache (key: hash teks chunk)
function loadCache() {
  const cache = new Map();
  if (!fs.existsSync(CHUNKS_PATH) || !fs.existsSync(EMBEDDINGS_PATH)) return cache;

  try {
    const oldChunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf8'));
    const oldEmbeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf8'));
    const embeddingById = new Map(oldEmbeddings.map((e) => [e.id, e.embedding]));

    for (const chunk of oldChunks) {
      const embedding = embeddingById.get(chunk.id);
      if (!embedding) continue;
      cache.set(chunk.hash || hashText(chunk.text), embedding);
    }
  } catch (error) {
    console.warn('⚠️  Cache embedding lama tidak bisa dibaca, semua chunk akan di-embed ulang.', error.message);
  }
  return cache;
}

async function main() {
  console.log('🚀 Memulai proses chunking dan embedding...');

  const newsData = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf8'));
  console.log(`📰 Loaded ${newsData.length} articles`);

  const cache = loadCache();
  const chunks = [];

  newsData.forEach((article, i) => {
    const fullText = `${article.title}\n\n${article.full_text}`;
    const articleChunks = splitIntoChunks(fullText);

    articleChunks.forEach((text, j) => {
      chunks.push({
        id: `chunk_${chunks.length}`,
        article_index: i,
        chunk_index: j,
        hash: hashText(text),
        text,
        metadata: {
          title: article.title,
          url: article.url,
          published_at: article.published_at || '',
          total_chunks: articleChunks.length,
        },
      });
    });
  });

  const missing = chunks.filter((c) => !cache.has(c.hash));
  console.log(`📦 ${chunks.length} chunks, ${chunks.length - missing.length} dari cache, ${missing.length} perlu di-embed`);

  if (missing.length > 0) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY tidak diset, padahal ada chunk baru yang perlu di-embed.');
    }
    for (let start = 0; start < missing.length; start += BATCH_SIZE) {
      const batch = missing.slice(start, start + BATCH_SIZE);
      console.log(`  🔄 Embedding chunk ${start + 1}-${start + batch.length}/${missing.length}`);
      const vectors = await generateEmbeddings(batch.map((c) => c.text));
      batch.forEach((c, k) => cache.set(c.hash, vectors[k]));
    }
  }

  const embeddings = chunks.map((c) => ({ id: c.id, embedding: cache.get(c.hash) }));

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Disimpan tanpa indent supaya file jauh lebih kecil
  fs.writeFileSync(CHUNKS_PATH, JSON.stringify(chunks));
  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddings));

  console.log(`💾 Saved ${chunks.length} chunks & ${embeddings.length} embeddings`);
  console.log('✅ Proses selesai!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  });
}

module.exports = { splitIntoChunks, generateEmbedding, generateEmbeddings };

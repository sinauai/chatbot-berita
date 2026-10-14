require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Konfigurasi
const CHUNK_SIZE = 800; // Target size per chunk
const OVERLAP_SIZE = 100; // Overlap antar chunk
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Fungsi untuk split text menjadi chunks
function splitIntoChunks(text, maxSize = CHUNK_SIZE, overlap = OVERLAP_SIZE) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxSize;
    
    // Jika tidak sampai akhir text, cari titik potong yang baik
    if (end < text.length) {
      // Cari titik potong di sentence boundary
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const lastSpace = text.lastIndexOf(' ', end);
      
      // Pilih titik potong terbaik
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

// Fungsi untuk generate embedding menggunakan OpenAI
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Fungsi utama
async function main() {
  try {
    console.log('🚀 Memulai proses chunking dan embedding...');
    
    // Baca news.json
    const newsPath = path.join(__dirname, '..', 'news.json');
    const newsData = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
    console.log(`📰 Loaded ${newsData.length} articles`);
    
    const chunks = [];
    const embeddings = [];
    let chunkId = 0;
    
    // Process setiap artikel
    for (let i = 0; i < newsData.length; i++) {
      const article = newsData[i];
      console.log(`📝 Processing article ${i + 1}/${newsData.length}: ${article.title.substring(0, 50)}...`);
      
      // Gabungkan title dan content untuk chunking
      const fullText = `${article.title}\n\n${article.full_text}`;
      
      // Split menjadi chunks
      const articleChunks = splitIntoChunks(fullText);
      
      // Process setiap chunk
      for (let j = 0; j < articleChunks.length; j++) {
        const chunkText = articleChunks[j];
        
        // Metadata untuk chunk
        const chunkData = {
          id: `chunk_${chunkId}`,
          article_index: i,
          chunk_index: j,
          text: chunkText,
          metadata: {
            title: article.title,
            url: article.url,
            published_at: article.published_at,
            total_chunks: articleChunks.length
          }
        };
        
        chunks.push(chunkData);
        
        // Generate embedding
        console.log(`  🔄 Generating embedding for chunk ${j + 1}/${articleChunks.length}`);
        const embedding = await generateEmbedding(chunkText);
        
        embeddings.push({
          id: `chunk_${chunkId}`,
          embedding: embedding
        });
        
        chunkId++;
        
        // Rate limiting - tunggu sebentar antar request
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Simpan chunks.json
    const chunksPath = path.join(__dirname, '..', 'data', 'chunks.json');
    const dataDir = path.dirname(chunksPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2));
    console.log(`💾 Saved ${chunks.length} chunks to chunks.json`);
    
    // Simpan embeddings.json
    const embeddingsPath = path.join(__dirname, '..', 'data', 'embeddings.json');
    fs.writeFileSync(embeddingsPath, JSON.stringify(embeddings, null, 2));
    console.log(`💾 Saved ${embeddings.length} embeddings to embeddings.json`);
    
    console.log('✅ Proses selesai!');
    console.log(`📊 Total chunks: ${chunks.length}`);
    console.log(`📊 Total embeddings: ${embeddings.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Jalankan script
if (require.main === module) {
  main();
}

module.exports = { splitIntoChunks, generateEmbedding };
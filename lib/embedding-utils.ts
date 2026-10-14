import fs from 'fs';
import path from 'path';

// Interface untuk chunk data
interface ChunkData {
  id: string;
  article_index: number;
  chunk_index: number;
  text: string;
  metadata: {
    title: string;
    url: string;
    published_at: string;
    total_chunks: number;
  };
}

// Interface untuk embedding data
interface EmbeddingData {
  id: string;
  embedding: number[];
}

// Interface untuk search result
interface SearchResult {
  chunk: ChunkData;
  similarity: number;
}

// Cache untuk chunks dan embeddings
let chunksCache: ChunkData[] | null = null;
let embeddingsCache: EmbeddingData[] | null = null;

// Fungsi untuk load chunks
export function loadChunks(): ChunkData[] {
  if (chunksCache) return chunksCache;
  
  try {
    const chunksPath = path.join(process.cwd(), 'data', 'chunks.json');
    const chunksData = fs.readFileSync(chunksPath, 'utf8');
    chunksCache = JSON.parse(chunksData);
    return chunksCache!;
  } catch (error) {
    console.error('Error loading chunks:', error);
    throw new Error('Failed to load chunks.json. Please run prepare-embeddings.js first.');
  }
}

// Fungsi untuk load embeddings
export function loadEmbeddings(): EmbeddingData[] {
  if (embeddingsCache) return embeddingsCache;
  
  try {
    const embeddingsPath = path.join(process.cwd(), 'data', 'embeddings.json');
    const embeddingsData = fs.readFileSync(embeddingsPath, 'utf8');
    embeddingsCache = JSON.parse(embeddingsData);
    return embeddingsCache!;
  } catch (error) {
    console.error('Error loading embeddings:', error);
    throw new Error('Failed to load embeddings.json. Please run prepare-embeddings.js first.');
  }
}

// Fungsi untuk generate embedding query menggunakan OpenAI
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    throw error;
  }
}

// Fungsi untuk hitung cosine similarity
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// Fungsi untuk cari top-k chunks yang paling relevan
export async function findTopKChunks(
  query: string, 
  k: number = 5,
  minSimilarity: number = 0.1
): Promise<SearchResult[]> {
  try {
    // Generate embedding untuk query
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Load chunks dan embeddings
    const chunks = loadChunks();
    const embeddings = loadEmbeddings();
    
    // Hitung similarity untuk setiap chunk
    const similarities: SearchResult[] = [];
    
    for (const embeddingData of embeddings) {
      const chunk = chunks.find(c => c.id === embeddingData.id);
      if (!chunk) continue;
      
      const similarity = cosineSimilarity(queryEmbedding, embeddingData.embedding);
      
      if (similarity >= minSimilarity) {
        similarities.push({
          chunk,
          similarity
        });
      }
    }
    
    // Sort berdasarkan similarity (descending) dan ambil top-k
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, k);
  } catch (error) {
    console.error('Error finding top-k chunks:', error);
    throw error;
  }
}

// Fungsi untuk build context dari relevant chunks
export function buildContextFromChunks(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return 'Tidak ada informasi yang relevan ditemukan.';
  }
  
  const contextParts: string[] = [];
  
  searchResults.forEach((result, index) => {
    const { chunk } = result;
    const articleRef = `ARTIKEL ${chunk.article_index + 1}`;
    
    contextParts.push(
      `${articleRef}:\n` +
      `Judul: ${chunk.metadata.title}\n` +
      `Tanggal: ${chunk.metadata.published_at}\n` +
      `Konten: ${chunk.text}\n`
    );
  });
  
  return contextParts.join('\n---\n\n');
}

// Fungsi untuk get article metadata dari chunks
export function getArticleMetadataFromChunks(searchResults: SearchResult[]): Array<{
  title: string;
  url: string;
  published_at: string;
}> {
  const seenArticles = new Set<number>();
  const metadata: Array<{
    title: string;
    url: string;
    published_at: string;
  }> = [];
  
  searchResults.forEach(result => {
    const articleIndex = result.chunk.article_index;
    if (!seenArticles.has(articleIndex)) {
      seenArticles.add(articleIndex);
      metadata.push({
        title: result.chunk.metadata.title,
        url: result.chunk.metadata.url,
        published_at: result.chunk.metadata.published_at
      });
    }
  });
  
  return metadata;
}

// Fungsi untuk clear cache (berguna untuk development)
export function clearCache(): void {
  chunksCache = null;
  embeddingsCache = null;
}

// Export types
export type { ChunkData, EmbeddingData, SearchResult };
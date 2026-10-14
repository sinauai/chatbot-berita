import fs from 'fs';
import path from 'path';

// Interface untuk chunk data
interface ChunkData {
  id: string;
  article_index: number;
  chunk_index: number;
  hash?: string;
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

interface IndexEntry {
  chunk: ChunkData;
  vector: Float32Array;
  norm: number;
}

// Cache index di memori (sekali per instance serverless)
let indexCache: IndexEntry[] | null = null;

function readJson<T>(file: string): T {
  const fullPath = path.join(process.cwd(), 'data', file);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
  } catch (error) {
    console.error(`Error loading ${file}:`, error);
    throw new Error(`Failed to load ${file}. Please run prepare-embeddings.js first.`);
  }
}

export function loadChunks(): ChunkData[] {
  return loadIndex().map((e) => e.chunk);
}

function vectorNorm(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

// Bangun index: gabungkan chunk + embedding lewat Map (O(n), bukan O(n²))
function loadIndex(): IndexEntry[] {
  if (indexCache) return indexCache;

  const chunks = readJson<ChunkData[]>('chunks.json');
  const embeddings = readJson<EmbeddingData[]>('embeddings.json');
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const index: IndexEntry[] = [];
  for (const { id, embedding } of embeddings) {
    const chunk = chunkById.get(id);
    if (!chunk || !embedding) continue;
    const vector = Float32Array.from(embedding);
    index.push({ chunk, vector, norm: vectorNorm(vector) });
  }

  indexCache = index;
  return index;
}

// Fungsi untuk generate embedding query menggunakan OpenAI
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
}

// Fungsi untuk hitung cosine similarity
export function cosineSimilarity(vecA: ArrayLike<number>, vecB: ArrayLike<number>): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i];
  const denom = vectorNorm(vecA) * vectorNorm(vecB);
  return denom === 0 ? 0 : dot / denom;
}

// Fungsi untuk cari top-k chunks yang paling relevan
export async function findTopKChunks(
  query: string,
  k: number = 5,
  minSimilarity: number = 0.1
): Promise<SearchResult[]> {
  const queryEmbedding = await generateQueryEmbedding(query);
  const queryNorm = vectorNorm(queryEmbedding);
  if (queryNorm === 0) return [];

  const results: SearchResult[] = [];
  for (const { chunk, vector, norm } of loadIndex()) {
    if (norm === 0 || vector.length !== queryEmbedding.length) continue;
    let dot = 0;
    for (let i = 0; i < vector.length; i++) dot += vector[i] * queryEmbedding[i];
    const similarity = dot / (norm * queryNorm);
    if (similarity >= minSimilarity) results.push({ chunk, similarity });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}

// Fungsi untuk build context dari relevant chunks
export function buildContextFromChunks(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) {
    return 'Tidak ada informasi yang relevan ditemukan.';
  }

  return searchResults
    .map(({ chunk }) =>
      `ARTIKEL ${chunk.article_index + 1}:\n` +
      `Judul: ${chunk.metadata.title}\n` +
      `Tanggal: ${chunk.metadata.published_at || '-'}\n` +
      `Konten: ${chunk.text}\n`
    )
    .join('\n---\n\n');
}

// Metadata artikel (unik) dari hasil retrieval, lengkap dengan nomor ARTIKEL-nya
export function getArticleMetadataFromChunks(searchResults: SearchResult[]): Array<{
  ref: number;
  title: string;
  url: string;
  published_at: string;
}> {
  const seen = new Set<number>();
  const metadata: Array<{ ref: number; title: string; url: string; published_at: string }> = [];

  for (const { chunk } of searchResults) {
    if (seen.has(chunk.article_index)) continue;
    seen.add(chunk.article_index);
    metadata.push({
      ref: chunk.article_index + 1,
      title: chunk.metadata.title,
      url: chunk.metadata.url,
      published_at: chunk.metadata.published_at,
    });
  }

  return metadata;
}

// Fungsi untuk clear cache (berguna untuk development)
export function clearCache(): void {
  indexCache = null;
}

export type { ChunkData, EmbeddingData, SearchResult };

import { type CoreMessage, streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { findTopKChunks, buildContextFromChunks } from "@/lib/embedding-utils"

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json()

  // Ambil query terakhir dari user
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  const userQuery = lastUserMessage?.content as string || ''

  // Cari chunks yang relevan menggunakan RAG
  let newsContext = ''
  try {
    const relevantChunks = await findTopKChunks(userQuery, 5, 0.2)
    newsContext = buildContextFromChunks(relevantChunks)
    
    console.log(`🔍 Found ${relevantChunks.length} relevant chunks for query: "${userQuery.substring(0, 50)}..."`)
  } catch (error) {
    console.error('Error in RAG search:', error)
    // Fallback: gunakan pesan error yang informatif
    newsContext = 'Maaf, terjadi kesalahan dalam mencari informasi yang relevan. Silakan coba lagi.'
  }

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `Anda adalah asisten AI yang HANYA dapat menjawab pertanyaan berdasarkan berita di Kompas.id.
    
    ATURAN KETAT:
    1. Anda DILARANG KERAS menggunakan pengetahuan umum atau informasi di luar konteks berita yang diberikan.
    2. Anda HARUS menolak semua pertanyaan tentang topik di luar konteks berita.
    3. Jika informasi tidak tersedia dalam konteks berita di bawah ini, Anda WAJIB menjawab: "Maaf, saya tidak memiliki informasi tentang itu dalam basis pengetahuan saya."
    
    KONTEKS BERITA YANG TERSEDIA:
    ${newsContext}
    
    INSTRUKSI TAMBAHAN:
    - Jika konteks kosong atau tidak relevan, tolak pertanyaan apapun
    - Jangan gunakan pengetahuan pre-training untuk menjawab pertanyaan umum
    - Format jawaban Anda dalam Markdown yang rapi untuk meningkatkan keterbacaan.
    - Gunakan paragraf, poin-poin, dan penekanan (bold/italic) dengan tepat.
    - JANGAN menyertakan referensi seperti "(ARTIKEL X)" dalam jawaban Anda. Pengguna sudah dapat melihat sumber informasi di bagian terpisah.
    - Tetap gunakan informasi dari artikel yang relevan, tetapi jangan menyebutkan nomor artikelnya dalam teks jawaban.
    - Untuk keperluan internal sistem, tetap sertakan kode artikel yang Anda gunakan di AKHIR jawaban Anda dengan format: "ARTIKEL 1 ARTIKEL 2" (jika Anda menggunakan artikel 1 dan 2). Kode ini akan dihapus sebelum ditampilkan kepada pengguna.
    
    
    Jawablah dalam Bahasa Indonesia yang baik dan benar.`,
    messages,
    temperature: 0.3,
  })

  return result.toDataStreamResponse()
}

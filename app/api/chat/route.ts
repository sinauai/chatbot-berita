import { type CoreMessage, createDataStreamResponse, streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import {
  findTopKChunks,
  buildContextFromChunks,
  getArticleMetadataFromChunks,
} from "@/lib/embedding-utils"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const maxDuration = 30

// Batas penggunaan untuk melindungi kuota OpenAI
const RATE_LIMIT = { limit: 15, windowMs: 60_000 } // 15 pertanyaan / menit / IP
const MAX_MESSAGES_TO_MODEL = 10 // riwayat yang diteruskan ke model
const MAX_MESSAGE_CHARS = 2000 // panjang maksimal per pesan

function textOf(message: CoreMessage): string {
  if (typeof message.content === "string") return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => (part?.type === "text" ? part.text : ""))
      .join(" ")
  }
  return ""
}

export async function POST(req: Request) {
  const limited = rateLimit(`chat:${getClientIp(req)}`, RATE_LIMIT)
  if (!limited.ok) {
    return new Response("Terlalu banyak pertanyaan. Silakan coba lagi sebentar lagi.", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSeconds) },
    })
  }

  let body: { messages?: CoreMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  // Hanya terima pesan user/assistant berupa teks, dipotong panjangnya
  const messages: CoreMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_MESSAGES_TO_MODEL)
    .map((m) => ({ role: m.role, content: textOf(m).slice(0, MAX_MESSAGE_CHARS) }) as CoreMessage)

  const userMessages = messages.filter((m) => m.role === "user")
  if (userMessages.length === 0) {
    return new Response("Bad request", { status: 400 })
  }

  // Query retrieval: pertanyaan terakhir + 2 pertanyaan sebelumnya, supaya
  // pertanyaan lanjutan ("kenapa begitu?") tetap mendapat konteks yang benar
  const retrievalQuery = userMessages
    .slice(-3)
    .map((m) => textOf(m))
    .join("\n")

  let newsContext = ""
  let sources: ReturnType<typeof getArticleMetadataFromChunks> = []
  try {
    const relevantChunks = await findTopKChunks(retrievalQuery, 5, 0.2)
    newsContext = buildContextFromChunks(relevantChunks)
    sources = getArticleMetadataFromChunks(relevantChunks)
  } catch (error) {
    console.error("Error in RAG search:", error)
    newsContext = "Tidak ada informasi yang relevan ditemukan."
  }

  return createDataStreamResponse({
    execute: (dataStream) => {
      // Kirim daftar artikel yang benar-benar diretrieve. Frontend hanya
      // menampilkan sumber yang ada di daftar ini.
      dataStream.writeMessageAnnotation({
        type: "sources",
        sources: sources.map(({ ref, title, url }) => ({ ref, title, url })),
      })

      const result = streamText({
        model: openai("gpt-6-luna"),
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
        // gpt-6-luna adalah model reasoning: temperature tidak didukung.
        // Effort "low" menjaga jawaban tetap cepat untuk chat berbasis konteks.
        providerOptions: { openai: { reasoningEffort: "low" } },
      })

      result.mergeIntoDataStream(dataStream)
    },
    onError: (error) => {
      console.error("Chat stream error:", error)
      return "Maaf, terjadi kesalahan. Silakan coba lagi."
    },
  })
}

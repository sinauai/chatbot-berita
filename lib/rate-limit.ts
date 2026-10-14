// Rate limiter sederhana berbasis memori (sliding window per IP).
// Catatan: di Vercel, memori tidak dibagi antar-instance serverless, jadi ini
// perlindungan "best effort". Untuk batas yang benar-benar global, ganti dengan
// store bersama seperti Upstash Redis / Vercel KV.

type Bucket = { timestamps: number[] }

const buckets = new Map<string, Bucket>()
let lastCleanup = Date.now()

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()

  // Bersihkan bucket lama sesekali supaya Map tidak tumbuh tanpa batas
  if (now - lastCleanup > windowMs) {
    for (const [k, b] of buckets) {
      if (b.timestamps.every((t) => now - t > windowMs)) buckets.delete(k)
    }
    lastCleanup = now
  }

  const bucket = buckets.get(key) ?? { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)

  if (bucket.timestamps.length >= limit) {
    const retryAfterMs = windowMs - (now - bucket.timestamps[0])
    buckets.set(key, bucket)
    return { ok: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return { ok: true, retryAfterSeconds: 0 }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// Origin yang boleh menyematkan chatbot (iframe) dan bertukar postMessage.
// Atur lewat env NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS (dipisah koma), contoh:
// NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS=https://www.kompas.id,https://kompas.id
const DEFAULT_ORIGINS = ["https://www.kompas.id", "https://kompas.id"]

export const EMBED_ALLOWED_ORIGINS: string[] = (process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean)

export const allowedOrigins = EMBED_ALLOWED_ORIGINS.length > 0 ? EMBED_ALLOWED_ORIGINS : DEFAULT_ORIGINS

// Origin halaman induk (kalau sedang di-iframe) dan hanya jika ada di allowlist
export function getParentOrigin(): string | null {
  if (typeof window === "undefined" || window.parent === window) return null
  let origin = ""
  const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
  if (ancestors && ancestors.length > 0) origin = ancestors[0]
  else if (document.referrer) {
    try {
      origin = new URL(document.referrer).origin
    } catch {}
  }
  return allowedOrigins.includes(origin) ? origin : null
}

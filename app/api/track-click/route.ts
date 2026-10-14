import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import newsData from '@/news.json'

// Hanya URL artikel yang memang ada di news.json yang boleh dicatat
const allowedUrls = new Map(newsData.map((a) => [a.url, a.title]))

const clip = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined

// POST /api/track-click
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  // Tracking tidak dikonfigurasi: abaikan diam-diam
  if (!supabase) return new NextResponse(null, { status: 204 })

  const limited = rateLimit(`click:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 })
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const article_url = clip(body?.article_url, 500)

    if (!article_url || !allowedUrls.has(article_url)) {
      return NextResponse.json({ error: 'Unknown article_url' }, { status: 400 })
    }

    const { error } = await supabase.from('article_clicks').insert({
      article_url,
      article_title: allowedUrls.get(article_url),
      session_id: clip(body?.session_id, 100),
      user_agent: clip(request.headers.get('user-agent'), 500),
      referrer_message_id: clip(body?.referrer_message_id, 100),
      clicked_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to track click' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

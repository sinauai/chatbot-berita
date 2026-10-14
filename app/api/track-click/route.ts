import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/track-click
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { article_url, article_title, session_id, referrer_message_id } = body

    // Validate required fields
    if (!article_url) {
      return NextResponse.json(
        { error: 'article_url is required' },
        { status: 400 }
      )
    }

    // Get additional metadata from request
    const user_agent = request.headers.get('user-agent') || undefined

    // Generate session ID if not provided
    const final_session_id = session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Insert click data into Supabase
    const { data, error } = await supabaseAdmin
      .from('article_clicks')
      .insert({
        article_url,
        article_title,
        session_id: final_session_id,
        user_agent,
        referrer_message_id,
        clicked_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to track click', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Click tracked successfully',
        session_id: final_session_id
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/track-click (optional - for testing)
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Article click tracking API is running',
      endpoints: {
        POST: '/api/track-click - Track an article click',
        body: {
          article_url: 'string (required)',
          article_title: 'string (optional)',
          session_id: 'string (optional - will be generated if not provided)',
          referrer_message_id: 'string (optional)'
        }
      }
    },
    { status: 200 }
  )
}
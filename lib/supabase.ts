import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for frontend (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client for server-side operations (uses service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

// Type definitions for our database
export interface ArticleClick {
  id?: number
  article_url: string
  article_title?: string
  clicked_at?: string
  session_id?: string
  user_agent?: string
  referrer_message_id?: string
  created_at?: string
}

// Helper function to track article clicks
export async function trackArticleClick(data: Omit<ArticleClick, 'id' | 'created_at' | 'clicked_at'>) {
  try {
    const { error } = await supabase
      .from('article_clicks')
      .insert({
        ...data,
        clicked_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error tracking article click:', error)
      return { success: false, error }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error tracking article click:', error)
    return { success: false, error }
  }
}

// Helper function to get article click stats (for future analytics)
export async function getArticleClickStats(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('article_clicks')
      .select('article_url, article_title, clicked_at')
      .order('clicked_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching article click stats:', error)
      return { success: false, error, data: null }
    }
    
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching article click stats:', error)
    return { success: false, error, data: null }
  }
}
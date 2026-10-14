import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Tracking bersifat opsional: client hanya dibuat kalau env lengkap.
// Hanya dipakai di server (service role key tidak pernah dikirim ke browser).
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let adminClient: SupabaseClient | null | undefined

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient
  adminClient =
    supabaseUrl && supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null
  return adminClient
}

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

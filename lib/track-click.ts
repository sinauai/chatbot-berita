// Utility function for tracking article clicks
// This is a separate module to keep tracking logic isolated from main app functionality

// Generate a session ID that persists during the browser session
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-session'
  
  let sessionId = sessionStorage.getItem('article-tracking-session')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('article-tracking-session', sessionId)
  }
  return sessionId
}

// Track article click - non-blocking, won't affect user experience
export async function trackArticleClick({
  url,
  title,
  messageId
}: {
  url: string
  title?: string
  messageId?: string
}) {
  // Only track in browser environment
  if (typeof window === 'undefined') return
  
  // Don't block user interaction - fire and forget
  try {
    // Use fetch with no-cors to avoid blocking
    fetch('/api/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        article_url: url,
        article_title: title,
        session_id: getSessionId(),
        referrer_message_id: messageId
      })
    }).catch(error => {
      // Silent fail - don't log to console to avoid noise
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Article tracking failed (non-critical):', error)
      }
    })
  } catch (error) {
    // Silent fail - tracking should never break the app
    if (process.env.NODE_ENV === 'development') {
      console.debug('Article tracking error (non-critical):', error)
    }
  }
}

// Optional: Track click with additional context
export function createClickTracker(messageId?: string) {
  return (url: string, title?: string) => {
    trackArticleClick({ url, title, messageId })
  }
}
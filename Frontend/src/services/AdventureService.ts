import { supabase } from '@/lib/supabase'

// FIXED: Use same-origin URLs via Vercel proxy - NO MORE CORS!
const API_BASE_URL = '' // All requests go through Vercel rewrites

interface StoryInitRequest {
  genre: string
  character: string
  worldAdditions: string
  actions: 'yes' | 'no'
}

interface StoryResponse {
  session_id: string
  story_content: string
  success: boolean
  message?: string
}

interface StoryActionRequest {
  sessionId: string
  userAction: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatHistoryResponse {
  session_id: string
  title: string
  system_prompt: string
  messages: ChatMessage[]
  success: boolean
}

interface SessionInfo {
  session_id: string
  title: string
  created_at: string
  last_updated: string
  message_count: number
  last_message_preview: string
  world_image_status?: 'pending' | 'ready' | 'failed'
  character_image_status?: 'pending' | 'ready' | 'failed'
}

interface SessionsResponse {
  sessions: SessionInfo[]
  total_sessions: number
}

// New RAG-specific interfaces
interface StorySummaryResponse {
  session_id: string
  summary: string
  success: boolean
}

interface MemorySearchRequest {
  session_id: string
  query: string
  limit?: number
}

interface Memory {
  content: string
  role: string
  memory_type: string
  timestamp: string
}

interface MemorySearchResponse {
  session_id: string
  memories: Memory[]
  success: boolean
}

interface MemoryHealthResponse {
  status: 'healthy' | 'unhealthy'
  memory_system: string
  message: string
}

// New image-related interfaces
interface ImageUrlResponse {
  url?: string
  success: boolean
  message?: string
}

interface ImageStatusResponse {
  world_status: 'pending' | 'ready' | 'failed'
  character_status: 'pending' | 'ready' | 'failed'
  world_updated_at?: string
  character_updated_at?: string
}

interface ImageHealthResponse {
  status: 'healthy' | 'unhealthy'
  image_system: string
  s3_bucket?: string
  message: string
}

// Helper function to get authorization headers with better error handling
async function getAuthHeaders() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Auth session error:', error)
      throw new Error('Authentication error')
    }
    
    if (!session?.access_token) {
      throw new Error('No authentication token found')
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  } catch (error) {
    console.error('Failed to get auth headers:', error)
    throw error
  }
}

export class AdventureService {
  // SIMPLIFIED: Fire-and-forget warmup for cold starts (no CORS needed now!)
  static async warmBackend(): Promise<void> {
    try {
      console.log('🔥 Warming backend (same-origin)...')
      
      // Fire-and-forget: same-origin calls, no CORS issues
      fetch('/health').catch(() => {})
      
      console.log('🔥 Warmup fired (same-origin)')
    } catch (error) {
      // Ignore errors - this is fire-and-forget warmup
      console.log('🔥 Warmup completed')
    }
  }

  // SIMPLIFIED: Always succeeds since no CORS to worry about
  static async checkImageHealth(): Promise<boolean> {
    console.log('🔥 Warming backend (same-origin)...')
    
    // Fire-and-forget warmup
    void this.warmBackend()
    
    console.log('🔥 Warmup initiated (same-origin)')
    return true
  }

  // Story methods - all now same-origin
  static async initializeStory(request: StoryInitRequest): Promise<StoryResponse> {
    try {
      console.log('🚀 Initializing story with request:', request)
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          genre: request.genre,
          character: request.character,
          world_additions: request.worldAdditions,
          actions: request.actions
        })
      })

      console.log('🚀 Story init response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        console.error('🚀 Story init error:', errorData)
        throw new Error(errorData.detail || 'Failed to initialize story')
      }

      const result = await response.json()
      console.log('🚀 Story init success:', result.success)
      return result
    } catch (error) {
      console.error('AdventureService.initializeStory error:', error)
      throw error
    }
  }

  static async takeStoryAction(sessionId: string, userAction: string): Promise<StoryResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          user_action: userAction
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to process action')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.takeStoryAction error:', error)
      throw error
    }
  }

  static async getSessionHistory(sessionId: string): Promise<ChatHistoryResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/session/${sessionId}`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to get session history')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.getSessionHistory error:', error)
      throw error
    }
  }

  static async getUserSessions(): Promise<SessionsResponse> {
    try {
      console.log('📚 Fetching user sessions...')
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/sessions`, {
        method: 'GET',
        headers
      })

      console.log('📚 Sessions response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        console.error('📚 Sessions error:', errorData)
        throw new Error(errorData.detail || 'Failed to get user sessions')
      }

      const result = await response.json()
      console.log('📚 Sessions result:', { 
        totalSessions: result.total_sessions, 
        sessionsLength: result.sessions?.length 
      })
      
      return {
        sessions: result.sessions || [],
        total_sessions: result.total_sessions || 0
      }
    } catch (error) {
      console.error('AdventureService.getUserSessions error:', error)
      return {
        sessions: [],
        total_sessions: 0
      }
    }
  }

  static async deleteSession(sessionId: string): Promise<{ message: string }> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/session/${sessionId}`, {
        method: 'DELETE',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to delete session')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.deleteSession error:', error)
      throw error
    }
  }

  // RAG methods - all same-origin now
  static async getStorySummary(sessionId: string): Promise<StorySummaryResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/summary/${sessionId}`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to get story summary')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.getStorySummary error:', error)
      throw error
    }
  }

  static async searchMemories(request: MemorySearchRequest): Promise<MemorySearchResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/search-memories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: request.session_id,
          query: request.query,
          limit: request.limit || 5
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to search memories')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.searchMemories error:', error)
      throw error
    }
  }

  static async checkMemoryHealth(): Promise<MemoryHealthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/memory`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to check memory health')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.checkMemoryHealth error:', error)
      return {
        status: 'unhealthy',
        memory_system: 'error',
        message: `Memory health check failed: ${error}`
      }
    }
  }

  // ENHANCED: Better error detection with HTTP status codes
  static async getImageStatus(chatId: string): Promise<ImageStatusResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/images/status/${chatId}`, {
        method: 'GET',
        headers,
        cache: 'no-store'  // CRITICAL: Avoid cached 502s
      })

      if (!response.ok) {
        // CRITICAL: Include HTTP status for better 502 detection
        throw new Error(`HTTP_${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error: any) {
      console.error('AdventureService.getImageStatus error:', error)
      // Include the original error message for better 502 detection
      throw new Error(error.message.includes('HTTP_') ? error.message : `Unknown error: ${error.message}`)
    }
  }

  static async getImageUrl(
    chatId: string, 
    imageType: 'world' | 'character', 
    variant: 'master' | 'web' | 'thumb' | 'avatar' = 'web'
  ): Promise<ImageUrlResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const params = new URLSearchParams({
        chat_id: chatId,
        image_type: imageType,
        variant: variant
      })
      
      const response = await fetch(`${API_BASE_URL}/api/images/get-url?${params}`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to get image URL')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.getImageUrl error:', error)
      throw error
    }
  }

  static async regenerateImages(chatId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders()
      
      const params = new URLSearchParams({
        chat_id: chatId
      })
      
      const response = await fetch(`${API_BASE_URL}/api/images/regenerate?${params}`, {
        method: 'POST',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to regenerate images')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.regenerateImages error:', error)
      throw error
    }
  }

  static async checkImageHealthFull(): Promise<ImageHealthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/images`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to check image health')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.checkImageHealthFull error:', error)
      return {
        status: 'unhealthy',
        image_system: 'error',
        message: `Image health check failed: ${error}`
      }
    }
  }

  // Utility methods
  static async isRagEnabled(): Promise<boolean> {
    try {
      const healthCheck = await this.checkMemoryHealth()
      return healthCheck.status === 'healthy'
    } catch (error) {
      console.warn('RAG features not available:', error)
      return false
    }
  }

  static async isImageGenerationEnabled(): Promise<boolean> {
    try {
      const healthCheck = await this.checkImageHealthFull()
      console.log('🖼️ Image health check result:', healthCheck)
      return healthCheck.status === 'healthy'
    } catch (error) {
      console.warn('Image generation not available:', error)
      return false
    }
  }

  // BULLETPROOF: Auto-retry image loading - NEVER shows red error banner!
  static async loadAdventureImagesWithRetry(
    adventure: any, 
    maxRetries: number = 8, // Much more aggressive retries
    forceRefresh: boolean = false
  ): Promise<any> {
    
    console.log(`🖼️ Starting bulletproof image loading for ${adventure.sessionId}`)
    
    // CRITICAL: Always return "loading" state initially, never error state
    const keepLoadingResult = {
      ...adventure,
      imageStatus: adventure.imageStatus || {
        world_status: 'pending',
        character_status: 'pending'
      },
      isImagesLoading: true,
      imageLoadError: false  // NEVER set this to true!
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖼️ Loading images attempt ${attempt}/${maxRetries} for ${adventure.sessionId}`)
        
        // Progressive warmup delays - longer delays for later attempts
        if (attempt === 1) {
          void this.warmBackend()
          await new Promise(r => setTimeout(r, 1500))
        } else {
          // Much longer delays to let Render fully wake up
          const delay = Math.min(3000 + (attempt * 2000), 15000)
          console.log(`🔄 Backend warming up... waiting ${delay}ms before attempt ${attempt}`)
          await new Promise(r => setTimeout(r, delay))
        }
        
        // Clear cache if forcing refresh
        if (forceRefresh) {
          this.clearImageCache(adventure.sessionId)
          console.log(`🔄 Cleared cache for ${adventure.sessionId}`)
        }
        
        // Try to get image status with very specific error handling
        let status
        try {
          console.log(`🔍 Checking image status (attempt ${attempt})...`)
          status = await this.getImageStatus(adventure.sessionId)
          console.log(`🖼️ ✅ Status check successful on attempt ${attempt}:`, status)
        } catch (statusError: any) {
          const errorMsg = statusError.message || 'unknown'
          console.log(`🔄 Status check failed on attempt ${attempt}: ${errorMsg}`)
          
          // For 502 errors or "Unknown error" (which is 502), continue retrying
          if (errorMsg.includes('502') || errorMsg.includes('Unknown error') || errorMsg.includes('Bad Gateway')) {
            console.log(`🔄 502/Gateway error - backend still warming up, will retry (${attempt}/${maxRetries})`)
            
            // If we're not on the last attempt, continue to retry
            if (attempt < maxRetries) {
              continue
            } else {
              // On final attempt, return loading state instead of failing
              console.log(`🔄 Max retries reached, but keeping in loading state (no red banner)`)
              return keepLoadingResult
            }
          }
          
          // For other types of errors, retry a few times then give up
          if (attempt < 3) {
            console.log(`🔄 Non-502 error, retrying... (${attempt}/${maxRetries})`)
            continue
          }
          
          // Final fallback - return loading state, never error state
          console.log(`🔄 Persistent error, keeping in loading state`)
          return keepLoadingResult
        }
        
        // If we got here, status check succeeded!
        let worldImageUrl = adventure.worldImageUrl
        let characterImageUrl = adventure.characterImageUrl

        // Try to load world image if ready
        if (status.world_status === 'ready' && (!worldImageUrl || forceRefresh)) {
          console.log(`🖼️ Loading world image...`)
          try {
            const fetchedWorldUrl = await this.getCachedImageUrl(adventure.sessionId, 'world', 'web')
            if (fetchedWorldUrl) {
              worldImageUrl = fetchedWorldUrl
              console.log(`🖼️ ✅ World image loaded successfully`)
            } else {
              console.log(`🖼️ ⚠️ World image URL not available yet`)
            }
          } catch (worldError: any) {
            console.warn(`🖼️ World image load failed (non-critical):`, worldError.message)
            // Don't fail the whole process - just continue without world image
          }
        }

        // Try to load character image if ready
        if (status.character_status === 'ready' && (!characterImageUrl || forceRefresh)) {
          console.log(`🖼️ Loading character image...`)
          try {
            const fetchedCharacterUrl = await this.getCachedImageUrl(adventure.sessionId, 'character', 'avatar')
            if (fetchedCharacterUrl) {
              characterImageUrl = fetchedCharacterUrl
              console.log(`🖼️ ✅ Character image loaded successfully`)
            } else {
              console.log(`🖼️ ⚠️ Character image URL not available yet`)
            }
          } catch (characterError: any) {
            console.warn(`🖼️ Character image load failed (non-critical):`, characterError.message)
            // Don't fail the whole process - just continue without character image
          }
        }

        // Success! Return the loaded adventure
        const successResult = {
          ...adventure,
          imageStatus: status,
          worldImageUrl: worldImageUrl || undefined,
          characterImageUrl: characterImageUrl || undefined,
          isImagesLoading: status.world_status === 'pending' || status.character_status === 'pending',
          imageLoadError: false // Always false - never show error banner
        }
        
        console.log(`🖼️ ✅ Image loading completed successfully on attempt ${attempt}!`)
        return successResult
        
      } catch (error: any) {
        console.warn(`🔄 Attempt ${attempt} encountered error:`, error.message)
        
        // Never give up - on final attempt, return loading state
        if (attempt === maxRetries) {
          console.log(`🔄 Final attempt failed, returning loading state (no error banner)`)
          return keepLoadingResult
        }
        
        // Continue to next attempt
        console.log(`🔄 Continuing to attempt ${attempt + 1}...`)
      }
    }

    // Final fallback (should never reach here)
    console.log(`🔄 Fallback: returning loading state`)
    return keepLoadingResult
  }

  // ENHANCED: More resilient waitForImages with better retry logic
  static async waitForImages(
    chatId: string, 
    maxWaitMs: number = 600000, // Increased to 10 minutes
    pollIntervalMs: number = 8000 // Slower polling to be gentler on cold starts
  ): Promise<ImageStatusResponse> {
    const startTime = Date.now()
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 8 // Allow more errors before giving up
    
    console.log(`🖼️ Starting enhanced image polling for ${chatId}`)
    
    // Gentle warmup
    try {
      console.log('🔥 Gently warming backend...')
      void this.warmBackend()
      await new Promise(r => setTimeout(r, 2000)) // Longer initial delay
      console.log('🔥 Initial warmup complete')
    } catch (warmupError) {
      console.warn('🔥 Warmup failed, continuing anyway:', warmupError)
    }
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        console.log(`🔍 Polling image status... (errors: ${consecutiveErrors}/${maxConsecutiveErrors})`)
        const status = await this.getImageStatus(chatId)
        
        // Reset error counter on successful call
        consecutiveErrors = 0
        console.log(`✅ Status poll successful:`, status)
        
        // Check if both images are complete
        const worldComplete = status.world_status === 'ready' || status.world_status === 'failed'
        const characterComplete = status.character_status === 'ready' || status.character_status === 'failed'
        
        if (worldComplete && characterComplete) {
          console.log(`🎉 Both images completed! Status:`, status)
          return status
        }
        
        // Wait before next poll
        console.log(`⏳ Images still generating, waiting ${pollIntervalMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        
      } catch (error: any) {
        consecutiveErrors++
        const errorMsg = error.message || 'unknown'
        console.warn(`🔄 Poll error ${consecutiveErrors}/${maxConsecutiveErrors}: ${errorMsg}`)
        
        // For 502/gateway errors, be very patient
        if (errorMsg.includes('502') || errorMsg.includes('Unknown error') || errorMsg.includes('Bad Gateway')) {
          console.log(`🔄 Gateway error - backend cold start, being patient...`)
          
          // Progressive backoff for cold starts
          const coldStartDelay = Math.min(5000 + (consecutiveErrors * 3000), 20000)
          console.log(`🔄 Waiting ${coldStartDelay}ms for backend to warm up...`)
          await new Promise(r => setTimeout(r, coldStartDelay))
          
          // Don't count cold start errors as heavily
          if (consecutiveErrors > maxConsecutiveErrors) {
            console.log(`🔄 Too many cold start errors, giving up polling`)
            throw new Error(`Backend appears to be persistently down`)
          }
          
          continue
        }
        
        // For other errors, use normal backoff
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`🚨 Too many consecutive errors, giving up`)
          throw new Error(`Too many consecutive polling errors: ${errorMsg}`)
        }
        
        const normalDelay = Math.min(pollIntervalMs * consecutiveErrors, 30000)
        console.log(`🔄 Normal error backoff: ${normalDelay}ms`)
        await new Promise(resolve => setTimeout(resolve, normalDelay))
      }
    }
    
    // Timeout reached
    console.warn(`⏰ Polling timeout reached for ${chatId}`)
    throw new Error('Image generation timeout - but images may still be processing')
  }

  // ENHANCED: Better error handling for getCachedImageUrl with retry
  static async getCachedImageUrl(
    chatId: string, 
    imageType: 'world' | 'character', 
    variant: 'master' | 'web' | 'thumb' | 'avatar' = 'web'
  ): Promise<string | null> {
    try {
      console.log(`🔗 Getting ${imageType} image URL for ${chatId}`)
      
      // Check cache first
      const cacheKey = `img_${chatId}_${imageType}_${variant}`
      const cachedData = sessionStorage.getItem(cacheKey)
      
      if (cachedData) {
        try {
          const { url, timestamp } = JSON.parse(cachedData)
          const age = Date.now() - timestamp
          const thirtyMinutes = 30 * 60 * 1000
          
          if (age < thirtyMinutes) {
            console.log(`🔗 Using cached ${imageType} URL`)
            return url
          } else {
            console.log(`🔗 Cached ${imageType} URL expired`)
            sessionStorage.removeItem(cacheKey)
          }
        } catch (e) {
          sessionStorage.removeItem(cacheKey)
        }
      }
      
      // Fetch fresh URL with retry logic for 502 errors
      let lastError: any = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔗 Fetching fresh ${imageType} URL (attempt ${attempt})`)
          const response = await this.getImageUrl(chatId, imageType, variant)
          
          if (response.success && response.url) {
            // Cache the new URL
            const cacheData = { url: response.url, timestamp: Date.now() }
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
            console.log(`🔗 ✅ Cached fresh ${imageType} URL`)
            return response.url
          } else {
            console.warn(`🔗 Image URL not ready yet: success=${response.success}`)
            return null
          }
        } catch (fetchError: any) {
          lastError = fetchError
          console.warn(`🔗 URL fetch attempt ${attempt} failed:`, fetchError.message)
          
          // For 502 errors, wait a bit before retrying
          if (fetchError.message.includes('502') && attempt < 3) {
            await new Promise(r => setTimeout(r, 2000 * attempt))
          }
        }
      }
      
      // All attempts failed
      console.warn(`🔗 All URL fetch attempts failed for ${imageType}:`, lastError?.message)
      return null
      
    } catch (error: any) {
      console.error(`🔗 Critical error getting ${imageType} URL:`, error.message)
      return null
    }
  }

  static async forceRefreshAdventureImages(adventure: any): Promise<any> {
    return this.loadAdventureImagesWithRetry(adventure, 8, true)
  }

  static clearImageCache(chatId: string): void {
    const cacheKeys = [
      `img_${chatId}_world_master`,
      `img_${chatId}_world_web`,
      `img_${chatId}_world_thumb`,
      `img_${chatId}_character_master`,
      `img_${chatId}_character_web`,
      `img_${chatId}_character_avatar`
    ]
    cacheKeys.forEach(key => sessionStorage.removeItem(key))
  }
}
import { supabase } from '@/lib/supabase'

// FIXED: Remove trailing slash to prevent double slashes in URLs
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://questweaver-819u.onrender.com'

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
  // NEW: Fire-and-forget warmup that bypasses CORS entirely
  static async warmBackend(): Promise<void> {
    try {
      console.log('🔥 Warming backend with no-cors mode...')
      
      // Fire-and-forget: no-cors doesn't require CORS headers and still wakes the instance
      // This is safe because we don't read the response and it's our own backend
      fetch(`${API_BASE_URL}/health`, { 
        method: 'GET', 
        mode: 'no-cors' 
      }).catch(() => {
        // Ignore errors - this is fire-and-forget warmup
      })
      
      // Also warm the image status endpoint path
      fetch(`${API_BASE_URL}/api/images/status/warmup`, { 
        method: 'OPTIONS', 
        mode: 'no-cors' 
      }).catch(() => {
        // Ignore errors - this is fire-and-forget warmup
      })
      
      console.log('🔥 Warmup requests fired (non-blocking)')
    } catch (error) {
      // Ignore all errors - this is fire-and-forget warmup
      console.log('🔥 Warmup initiation completed (errors ignored)')
    }
  }

  // UPDATED: Non-blocking warmup that always succeeds
  static async checkImageHealth(): Promise<boolean> {
    try {
      console.log('🔥 Warming backend (no-cors mode)...')
      
      // Fire-and-forget warmup - don't await it
      void this.warmBackend()
      
      // Always return true since we're not blocking on the warmup
      console.log('🔥 Warmup initiated (non-blocking)')
      return true
    } catch (error) {
      console.warn('AdventureService.checkImageHealth error:', error)
      // Even on error, return true since warmup is fire-and-forget
      return true
    }
  }

  // FIXED: Improved error handling for story initialization
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

  // FIXED: Better handling when no sessions exist
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
      
      // Ensure we always return a valid structure
      return {
        sessions: result.sessions || [],
        total_sessions: result.total_sessions || 0
      }
    } catch (error) {
      console.error('AdventureService.getUserSessions error:', error)
      // Return empty result instead of throwing error
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

  // New RAG-enhanced methods
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

  // New Image-related methods
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

  static async getImageStatus(chatId: string): Promise<ImageStatusResponse> {
    try {
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/images/status/${chatId}`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to get image status')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.getImageStatus error:', error)
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

  // FIXED: Better error handling for health checks - now calls lightweight endpoint
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

  // Utility method to check if RAG features are available
  static async isRagEnabled(): Promise<boolean> {
    try {
      const healthCheck = await this.checkMemoryHealth()
      return healthCheck.status === 'healthy'
    } catch (error) {
      console.warn('RAG features not available:', error)
      return false
    }
  }

  // FIXED: Better error handling for image feature availability
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

  // UPDATED: Enhanced waitForImages with non-blocking warmup
  static async waitForImages(
    chatId: string, 
    maxWaitMs: number = 300000, // 5 minutes
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<ImageStatusResponse> {
    const startTime = Date.now()
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 3
    
    // CRITICAL: Non-blocking warmup
    try {
      console.log('🔥 Warming up service for image polling (non-blocking)...')
      void this.warmBackend()  // Fire-and-forget
      
      // CRITICAL: Add buffer after warmup initiation
      console.log('🔥 Adding post-warmup buffer...')
      await new Promise(r => setTimeout(r, 1500))  // Longer buffer for warmup
      console.log('🔥 Service should be warmed up by now')
    } catch (warmupError) {
      console.warn('🔥 Warmup initiation failed, continuing anyway:', warmupError)
    }
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.getImageStatus(chatId)
        
        // Reset error counter on successful call
        consecutiveErrors = 0
        
        // Check if both images are complete (ready or failed)
        const worldComplete = status.world_status === 'ready' || status.world_status === 'failed'
        const characterComplete = status.character_status === 'ready' || status.character_status === 'failed'
        
        if (worldComplete && characterComplete) {
          return status
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        
      } catch (error: any) {
        consecutiveErrors++
        console.error(`Error polling image status (${consecutiveErrors}/${maxConsecutiveErrors}):`, error)
        
        // ENHANCED: Auto-retry for cold start/proxy errors with longer delays
        if ((error instanceof TypeError || 
             /CORS|Failed to fetch|502|Bad Gateway/i.test(String(error))) && 
            consecutiveErrors <= 2) {  // Allow more retries for cold start
          
          console.warn("🔥 Cold start/proxy error detected; auto-retrying with longer delay...")
          
          // Progressive delay for cold start issues
          const retryDelay = consecutiveErrors === 1 ? 2000 : 3000
          await new Promise(r => setTimeout(r, retryDelay))
          
          try {
            // Silent retry for cold start issues
            const retryStatus = await this.getImageStatus(chatId)
            consecutiveErrors = 0  // Reset on success
            
            const worldComplete = retryStatus.world_status === 'ready' || retryStatus.world_status === 'failed'
            const characterComplete = retryStatus.character_status === 'ready' || retryStatus.character_status === 'failed'
            
            if (worldComplete && characterComplete) {
              return retryStatus
            }
            
            continue  // Continue with normal polling
          } catch (retryError) {
            console.warn("🔥 Auto-retry also failed, will continue with normal retry flow")
            // Fall through to normal error handling
          }
        }
        
        // If we hit too many consecutive errors, it might be a persistent issue
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`Too many consecutive polling errors: ${error.message}`)
        }
        
        // For cold start/proxy errors, wait longer between polls
        const isProxyError = error.message.includes('CORS') || 
                            error.message.includes('502') || 
                            error.message.includes('Bad Gateway') ||
                            error instanceof TypeError
        
        const delay = isProxyError ? pollIntervalMs * 2 : pollIntervalMs
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // Timeout reached
    throw new Error('Image generation timeout')
  }

  // FIXED: Utility method to get fresh image URLs with better caching
  static async getCachedImageUrl(
    chatId: string, 
    imageType: 'world' | 'character', 
    variant: 'master' | 'web' | 'thumb' | 'avatar' = 'web'
  ): Promise<string | null> {
    try {
      console.log(`🔗 Fetching ${imageType} image URL for ${chatId} (${variant})`)
      
      // Check if we have a recent URL (less than 30 minutes old)
      const cacheKey = `img_${chatId}_${imageType}_${variant}`
      const cachedData = sessionStorage.getItem(cacheKey)
      
      if (cachedData) {
        try {
          const { url, timestamp } = JSON.parse(cachedData)
          const age = Date.now() - timestamp
          const thirtyMinutes = 30 * 60 * 1000
          
          if (age < thirtyMinutes) {
            console.log(`🔗 Using cached ${imageType} URL (${Math.round(age/60000)}min old)`)
            return url
          } else {
            console.log(`🔗 Cached ${imageType} URL expired, fetching fresh`)
            sessionStorage.removeItem(cacheKey)
          }
        } catch (e) {
          sessionStorage.removeItem(cacheKey)
        }
      }
      
      // Fetch fresh URL with enhanced error handling
      try {
        const response = await this.getImageUrl(chatId, imageType, variant)
        
        console.log(`🔗 ${imageType} URL response:`, response)
        
        if (response.success && response.url) {
          // Cache the new URL
          const cacheData = {
            url: response.url,
            timestamp: Date.now()
          }
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
          
          console.log(`🔗 Successfully got and cached ${imageType} URL`)
          return response.url
        }
        
        console.warn(`🔗 Failed to get ${imageType} URL: success=${response.success}, url=${!!response.url}`)
        return null
        
      } catch (fetchError: any) {
        // ENHANCED ERROR HANDLING for CORS and network issues
        if (fetchError.message.includes('CORS') || 
            fetchError.message.includes('Failed to fetch') ||
            fetchError.message.includes('NetworkError') ||
            fetchError.message.includes('Access to fetch') ||
            fetchError.name === 'TypeError') {
          
          console.warn(`🔗 CORS/Network error for ${imageType} image, will retry later:`, fetchError.message)
          
          // For CORS errors, don't throw - return null to allow retry
          // This prevents breaking the entire image loading flow
          return null
        }
        
        // For other errors, check if it's a 404 or server error
        if (fetchError.status === 404 || fetchError.status === 500) {
          console.warn(`🔗 Server error ${fetchError.status} for ${imageType} image:`, fetchError.message)
          return null
        }
        
        // For unexpected errors, log and throw
        console.error(`🔗 Unexpected error getting ${imageType} image URL:`, fetchError)
        throw fetchError
      }
      
    } catch (error: any) {
      console.error(`🔗 Critical error in getCachedImageUrl for ${imageType}:`, error)
      
      // Even for critical errors, return null instead of throwing
      // This ensures the UI doesn't break and allows for retry mechanisms
      return null
    }
  }

  // UPDATED: Enhanced loadAdventureImagesWithRetry with non-blocking warmup
  static async loadAdventureImagesWithRetry(
    adventure: any, 
    maxRetries: number = 3,
    forceRefresh: boolean = false
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖼️ Loading images for adventure ${adventure.sessionId} (attempt ${attempt}/${maxRetries})`)
        
        // CRITICAL: Non-blocking warmup on initial attempt
        if (attempt === 1) {
          try {
            console.log('🔥 Warming up service before image status check (non-blocking)...')
            void this.warmBackend()  // Fire-and-forget
            await new Promise(r => setTimeout(r, 1000))  // Buffer after warmup initiation
            console.log('🔥 Service warmup initiated')
          } catch (warmupError) {
            console.warn('🔥 Warmup initiation failed, continuing anyway:', warmupError)
          }
        }
        
        // Clear cache if forcing refresh
        if (forceRefresh) {
          const cacheKeys = [
            `img_${adventure.sessionId}_world_web`,
            `img_${adventure.sessionId}_character_avatar`
          ]
          cacheKeys.forEach(key => sessionStorage.removeItem(key))
          console.log(`🔄 Cleared cache for adventure ${adventure.sessionId}`)
        }
        
        // Get image status with enhanced cold start retry
        let status
        try {
          status = await this.getImageStatus(adventure.sessionId)
          console.log(`🖼️ Image status for ${adventure.sessionId}:`, status)
        } catch (statusError: any) {
          // ENHANCED: More aggressive auto-retry for cold start errors
          if ((statusError instanceof TypeError || 
               /CORS|Failed to fetch|502|Bad Gateway/i.test(String(statusError)))) {
            
            console.warn(`🔥 Cold start error getting status, auto-retrying with delay...`)
            await new Promise(resolve => setTimeout(resolve, 2000))  // Longer delay
            
            try {
              status = await this.getImageStatus(adventure.sessionId)
              console.log(`🖼️ ✅ Auto-retry successful for ${adventure.sessionId}`)
            } catch (retryError) {
              console.warn(`🔥 Auto-retry failed, will use normal retry flow`)
              throw statusError  // Throw original error for normal retry handling
            }
          } else {
            throw statusError
          }
        }
        
        let worldImageUrl = adventure.worldImageUrl
        let characterImageUrl = adventure.characterImageUrl

        // Load world image if ready and not already loaded (or forcing refresh)
        if (status.world_status === 'ready' && (!worldImageUrl || forceRefresh)) {
          console.log(`🖼️ Attempting to load world image for ${adventure.sessionId}`)
          
          try {
            const fetchedWorldUrl = await this.getCachedImageUrl(adventure.sessionId, 'world', 'web')
            if (fetchedWorldUrl) {
              worldImageUrl = fetchedWorldUrl
              console.log(`🖼️ ✅ World image URL loaded successfully`)
            } else {
              console.log(`🖼️ ❌ Failed to get world image URL`)
            }
          } catch (worldError: any) {
            console.warn(`🖼️ World image load failed:`, worldError.message)
          }
        }

        // Load character image if ready and not already loaded (or forcing refresh)
        if (status.character_status === 'ready' && (!characterImageUrl || forceRefresh)) {
          console.log(`🖼️ Attempting to load character image for ${adventure.sessionId}`)
          
          try {
            const fetchedCharacterUrl = await this.getCachedImageUrl(adventure.sessionId, 'character', 'avatar')
            if (fetchedCharacterUrl) {
              characterImageUrl = fetchedCharacterUrl
              console.log(`🖼️ ✅ Character image URL loaded successfully`)
            } else {
              console.log(`🖼️ ❌ Failed to get character image URL`)
            }
          } catch (characterError: any) {
            console.warn(`🖼️ Character image load failed:`, characterError.message)
          }
        }

        const result = {
          ...adventure,
          imageStatus: status,
          worldImageUrl: worldImageUrl || undefined,
          characterImageUrl: characterImageUrl || undefined,
          isImagesLoading: status.world_status === 'pending' || status.character_status === 'pending',
          imageLoadError: false
        }
        
        console.log(`🖼️ Final result for ${adventure.sessionId}:`, {
          worldUrl: !!result.worldImageUrl,
          characterUrl: !!result.characterImageUrl,
          isLoading: result.isImagesLoading,
          worldStatus: status.world_status,
          characterStatus: status.character_status
        })
        
        return result
        
      } catch (error: any) {
        console.error(`🖼️ Attempt ${attempt} failed for adventure ${adventure.sessionId}:`, error)
        
        if (attempt === maxRetries) {
          console.error(`🖼️ All attempts failed for adventure ${adventure.sessionId}`)
          return {
            ...adventure,
            imageLoadError: true,
            isImagesLoading: false
          }
        }
        
        // Enhanced backoff for cold start scenarios
        const isProxyError = error.message.includes('CORS') || 
                            error.message.includes('502') || 
                            error.message.includes('Bad Gateway') ||
                            error.message.includes('Failed to fetch') ||
                            error instanceof TypeError
        
        const delay = isProxyError 
          ? Math.min(3000 * attempt, 10000)  // Longer delays for proxy errors
          : Math.min(1000 * Math.pow(2, attempt - 1), 5000)  // Exponential backoff for other errors
        
        console.log(`🖼️ Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // NEW: Force refresh images for a specific adventure
  static async forceRefreshAdventureImages(adventure: any): Promise<any> {
    console.log(`🔄 Force refreshing images for adventure ${adventure.sessionId}`)
    return this.loadAdventureImagesWithRetry(adventure, 3, true)
  }

  // NEW: Clear all cached URLs for an adventure
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
    console.log(`🗑️ Cleared image cache for ${chatId}`)
  }
}
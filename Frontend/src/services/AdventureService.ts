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

  // Image methods - all same-origin now, NO MORE CORS!
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

  // SIMPLIFIED: Enhanced waitForImages with same-origin calls
  static async waitForImages(
    chatId: string, 
    maxWaitMs: number = 300000,
    pollIntervalMs: number = 5000
  ): Promise<ImageStatusResponse> {
    const startTime = Date.now()
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 3
    
    // Simple warmup
    try {
      console.log('🔥 Warming up service (same-origin)...')
      void this.warmBackend()
      await new Promise(r => setTimeout(r, 1000))
      console.log('🔥 Service warmed up')
    } catch (warmupError) {
      console.warn('🔥 Warmup failed, continuing:', warmupError)
    }
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.getImageStatus(chatId)
        consecutiveErrors = 0
        
        const worldComplete = status.world_status === 'ready' || status.world_status === 'failed'
        const characterComplete = status.character_status === 'ready' || status.character_status === 'failed'
        
        if (worldComplete && characterComplete) {
          return status
        }
        
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        
      } catch (error: any) {
        consecutiveErrors++
        console.error(`Error polling image status (${consecutiveErrors}/${maxConsecutiveErrors}):`, error)
        
        // Auto-retry for 502 errors (cold starts)
        if (error.message.includes('502') && consecutiveErrors <= 2) {
          console.warn("🔥 Cold start 502, auto-retrying...")
          await new Promise(r => setTimeout(r, 2000))
          
          try {
            const retryStatus = await this.getImageStatus(chatId)
            consecutiveErrors = 0
            
            const worldComplete = retryStatus.world_status === 'ready' || retryStatus.world_status === 'failed'
            const characterComplete = retryStatus.character_status === 'ready' || retryStatus.character_status === 'failed'
            
            if (worldComplete && characterComplete) {
              return retryStatus
            }
            continue
          } catch (retryError) {
            console.warn("🔥 Auto-retry failed, continuing normal flow")
          }
        }
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`Too many consecutive polling errors: ${error.message}`)
        }
        
        const delay = error.message.includes('502') ? pollIntervalMs * 2 : pollIntervalMs
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw new Error('Image generation timeout')
  }

  // SIMPLIFIED: Image loading with same-origin calls
  static async loadAdventureImagesWithRetry(
    adventure: any, 
    maxRetries: number = 3,
    forceRefresh: boolean = false
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖼️ Loading images for adventure ${adventure.sessionId} (attempt ${attempt}/${maxRetries})`)
        
        // Simple warmup on first attempt
        if (attempt === 1) {
          void this.warmBackend()
          await new Promise(r => setTimeout(r, 800))
        }
        
        // Clear cache if forcing refresh
        if (forceRefresh) {
          const cacheKeys = [
            `img_${adventure.sessionId}_world_web`,
            `img_${adventure.sessionId}_character_avatar`
          ]
          cacheKeys.forEach(key => sessionStorage.removeItem(key))
        }
        
        // Get image status with retry for 502 errors
        let status
        try {
          status = await this.getImageStatus(adventure.sessionId)
        } catch (statusError: any) {
          if (statusError.message.includes('502')) {
            console.warn(`🔥 Cold start 502, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1500))
            status = await this.getImageStatus(adventure.sessionId)
          } else {
            throw statusError
          }
        }
        
        let worldImageUrl = adventure.worldImageUrl
        let characterImageUrl = adventure.characterImageUrl

        // Load images if ready
        if (status.world_status === 'ready' && (!worldImageUrl || forceRefresh)) {
          try {
            const fetchedWorldUrl = await this.getCachedImageUrl(adventure.sessionId, 'world', 'web')
            if (fetchedWorldUrl) {
              worldImageUrl = fetchedWorldUrl
            }
          } catch (worldError: any) {
            console.warn(`🖼️ World image load failed:`, worldError.message)
          }
        }

        if (status.character_status === 'ready' && (!characterImageUrl || forceRefresh)) {
          try {
            const fetchedCharacterUrl = await this.getCachedImageUrl(adventure.sessionId, 'character', 'avatar')
            if (fetchedCharacterUrl) {
              characterImageUrl = fetchedCharacterUrl
            }
          } catch (characterError: any) {
            console.warn(`🖼️ Character image load failed:`, characterError.message)
          }
        }

        return {
          ...adventure,
          imageStatus: status,
          worldImageUrl: worldImageUrl || undefined,
          characterImageUrl: characterImageUrl || undefined,
          isImagesLoading: status.world_status === 'pending' || status.character_status === 'pending',
          imageLoadError: false
        }
        
      } catch (error: any) {
        console.error(`🖼️ Attempt ${attempt} failed:`, error)
        
        if (attempt === maxRetries) {
          return {
            ...adventure,
            imageLoadError: true,
            isImagesLoading: false
          }
        }
        
        const delay = error.message.includes('502') ? 3000 * attempt : 1000 * attempt
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // Keep existing utility methods
  static async getCachedImageUrl(
    chatId: string, 
    imageType: 'world' | 'character', 
    variant: 'master' | 'web' | 'thumb' | 'avatar' = 'web'
  ): Promise<string | null> {
    try {
      const cacheKey = `img_${chatId}_${imageType}_${variant}`
      const cachedData = sessionStorage.getItem(cacheKey)
      
      if (cachedData) {
        try {
          const { url, timestamp } = JSON.parse(cachedData)
          const age = Date.now() - timestamp
          const thirtyMinutes = 30 * 60 * 1000
          
          if (age < thirtyMinutes) {
            return url
          } else {
            sessionStorage.removeItem(cacheKey)
          }
        } catch (e) {
          sessionStorage.removeItem(cacheKey)
        }
      }
      
      const response = await this.getImageUrl(chatId, imageType, variant)
      
      if (response.success && response.url) {
        const cacheData = {
          url: response.url,
          timestamp: Date.now()
        }
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
        return response.url
      }
      
      return null
    } catch (error: any) {
      console.error(`🔗 Error getting ${imageType} image URL:`, error)
      return null
    }
  }

  static async forceRefreshAdventureImages(adventure: any): Promise<any> {
    return this.loadAdventureImagesWithRetry(adventure, 3, true)
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
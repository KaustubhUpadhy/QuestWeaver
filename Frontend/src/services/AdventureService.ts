import { supabase } from '@/lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://questweaver-production.up.railway.app/'

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

// Helper function to get authorization headers
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('No authentication token found')
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
}

export class AdventureService {
  // Existing methods remain unchanged
  static async initializeStory(request: StoryInitRequest): Promise<StoryResponse> {
    try {
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

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to initialize story')
      }

      return await response.json()
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
        const errorData = await response.json()
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
        const errorData = await response.json()
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
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}/api/story/sessions`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get user sessions')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.getUserSessions error:', error)
      throw error
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
        const errorData = await response.json()
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
        const errorData = await response.json()
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
        const errorData = await response.json()
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
      throw error
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
        const errorData = await response.json()
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
        const errorData = await response.json()
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
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to regenerate images')
      }

      return await response.json()
    } catch (error) {
      console.error('AdventureService.regenerateImages error:', error)
      throw error
    }
  }

  static async checkImageHealth(): Promise<ImageHealthResponse> {
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
      console.error('AdventureService.checkImageHealth error:', error)
      throw error
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

  // Utility method to check if image features are available
  static async isImageGenerationEnabled(): Promise<boolean> {
    try {
      const healthCheck = await this.checkImageHealth()
      return healthCheck.status === 'healthy'
    } catch (error) {
      console.warn('Image generation not available:', error)
      return false
    }
  }

  // Utility method to poll image status until ready or failed
  static async waitForImages(
    chatId: string, 
    maxWaitMs: number = 300000, // 5 minutes
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<ImageStatusResponse> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.getImageStatus(chatId)
        
        // Check if both images are complete (ready or failed)
        const worldComplete = status.world_status === 'ready' || status.world_status === 'failed'
        const characterComplete = status.character_status === 'ready' || status.character_status === 'failed'
        
        if (worldComplete && characterComplete) {
          return status
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        
      } catch (error) {
        console.error('Error polling image status:', error)
        // Continue polling on error
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
      }
    }
    
    // Timeout reached
    throw new Error('Image generation timeout')
  }

  // FIXED: Utility method to get fresh image URLs without localStorage
  static async getCachedImageUrl(
    chatId: string, 
    imageType: 'world' | 'character', 
    variant: 'master' | 'web' | 'thumb' | 'avatar' = 'web'
  ): Promise<string | null> {
    try {
      console.log(`🔗 Fetching ${imageType} image URL for ${chatId} (${variant})`)
      
      // Always fetch fresh URL instead of using localStorage
      // This ensures we get valid, non-expired URLs
      const response = await this.getImageUrl(chatId, imageType, variant)
      
      console.log(`🔗 ${imageType} URL response:`, response)
      
      if (response.success && response.url) {
        console.log(`🔗 Successfully got ${imageType} URL:`, response.url.substring(0, 50) + '...')
        return response.url
      }
      
      console.warn(`🔗 Failed to get ${imageType} URL: success=${response.success}, url=${!!response.url}`)
      return null
    } catch (error) {
      console.error(`🔗 Error getting ${imageType} image URL:`, error)
      return null
    }
  }

  // NEW: Enhanced image loading with retry logic
  static async loadAdventureImagesWithRetry(
    adventure: any, 
    maxRetries: number = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖼️ Loading images for adventure ${adventure.sessionId} (attempt ${attempt})`)
        
        // Get image status first
        const status = await this.getImageStatus(adventure.sessionId)
        console.log(`🖼️ Image status for ${adventure.sessionId}:`, status)
        
        let worldImageUrl = adventure.worldImageUrl
        let characterImageUrl = adventure.characterImageUrl

        // Load world image if ready and not already loaded
        if (status.world_status === 'ready' && !worldImageUrl) {
          console.log(`🖼️ Attempting to load world image for ${adventure.sessionId}`)
          const fetchedWorldUrl = await this.getCachedImageUrl(adventure.sessionId, 'world', 'web')
          if (fetchedWorldUrl) {
            worldImageUrl = fetchedWorldUrl
            console.log(`🖼️ ✅ World image URL loaded successfully`)
          } else {
            console.log(`🖼️ ❌ Failed to get world image URL`)
          }
        }

        // Load character image if ready and not already loaded  
        if (status.character_status === 'ready' && !characterImageUrl) {
          console.log(`🖼️ Attempting to load character image for ${adventure.sessionId}`)
          const fetchedCharacterUrl = await this.getCachedImageUrl(adventure.sessionId, 'character', 'avatar')
          if (fetchedCharacterUrl) {
            characterImageUrl = fetchedCharacterUrl
            console.log(`🖼️ ✅ Character image URL loaded successfully`)
          } else {
            console.log(`🖼️ ❌ Failed to get character image URL`)
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
          worldUrlPreview: result.worldImageUrl ? result.worldImageUrl.substring(0, 50) + '...' : 'none',
          characterUrlPreview: result.characterImageUrl ? result.characterImageUrl.substring(0, 50) + '...' : 'none'
        })
        
        return result
      } catch (error) {
        console.error(`🖼️ Attempt ${attempt} failed for adventure ${adventure.sessionId}:`, error)
        
        if (attempt === maxRetries) {
          // Mark as failed after all retries
          console.error(`🖼️ All attempts failed for adventure ${adventure.sessionId}`)
          return {
            ...adventure,
            imageLoadError: true,
            isImagesLoading: false
          }
        }
        
        // Wait before retry (exponential backoff)
        const delay = 1000 * Math.pow(2, attempt - 1)
        console.log(`🖼️ Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
}
import { supabase } from '@/lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
}
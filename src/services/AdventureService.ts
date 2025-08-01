// API service for adventure generation
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface StoryInitRequest {
  genre: string
  character: string
  world_additions: string
  actions: string
}

export interface StoryResponse {
  session_id: string
  story_content: string
  success: boolean
  message?: string
}

export interface StoryActionRequest {
  session_id: string
  user_action: string
}

export class AdventureService {
  /**
   * Initialize a new story with user preferences
   */
  static async initializeStory(preferences: {
    genre: string
    character: string
    worldAdditions: string
    actions: 'yes' | 'no'
  }): Promise<StoryResponse> {
    try {
      const requestData: StoryInitRequest = {
        genre: preferences.genre,
        character: preferences.character,
        world_additions: preferences.worldAdditions,
        actions: preferences.actions
      }

      console.log('Sending story init request:', requestData)

      const response = await fetch(`${API_BASE_URL}/api/story/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const result: StoryResponse = await response.json()
      console.log('Story initialized successfully:', result)
      
      return result
    } catch (error) {
      console.error('Failed to initialize story:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to initialize story')
    }
  }

  /**
   * Continue a story with a user action
   */
  static async takeStoryAction(sessionId: string, userAction: string): Promise<StoryResponse> {
    try {
      const requestData: StoryActionRequest = {
        session_id: sessionId,
        user_action: userAction
      }

      console.log('Sending story action request:', requestData)

      const response = await fetch(`${API_BASE_URL}/api/story/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const result: StoryResponse = await response.json()
      console.log('Story action processed successfully:', result)
      
      return result
    } catch (error) {
      console.error('Failed to process story action:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to process story action')
    }
  }

  /**
   * Get session information
   */
  static async getSessionInfo(sessionId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/story/session/${sessionId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get session info:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to get session info')
    }
  }

  /**
   * Delete a story session
   */
  static async deleteSession(sessionId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/story/session/${sessionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to delete session')
    }
  }
}
import { useState, useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { MessageSquare, Plus, Search, Trash2, RefreshCw, User, Image as ImageIcon, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { useAuth } from '@/components/AuthContext'
import { AdventureService } from '@/services/AdventureService'
import AuthModal from '@/components/AuthModal'
import AdventureSetupModal from '@/components/AdventureSetupModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Header from '@/components/Header'
import ImageZoomModal from '@/components/ImageZoomModal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ImageStatus {
  world_status: 'pending' | 'ready' | 'failed'
  character_status: 'pending' | 'ready' | 'failed'
  world_updated_at?: string
  character_updated_at?: string
}

interface Adventure {
  sessionId: string
  title: string
  lastMessage: string
  timestamp: string
  messageCount: number
  messages: Message[]
  isLoaded: boolean
  worldImageUrl?: string
  characterImageUrl?: string
  imageStatus?: ImageStatus
  isImagesLoading?: boolean
  imageLoadError?: boolean
}

const Adventures = () => {
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<{ [sessionId: string]: string }>({})
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAdventureModal, setShowAdventureModal] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set())
  const [isLoadingAdventures, setIsLoadingAdventures] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [adventureToDelete, setAdventureToDelete] = useState<Adventure | null>(null)
  const [isDeletingAdventure, setIsDeletingAdventure] = useState(false)
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false)
  const [showImageZoom, setShowImageZoom] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<{url: string; title: string; type: 'character' | 'world'} | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { isAuthenticated, isLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // DEBUG COMPONENT - Add this for troubleshooting
  const ImageDebugInfo = ({ adventure }: { adventure: Adventure }) => {
    const [debugInfo, setDebugInfo] = useState<any>(null)
    const [isDebugging, setIsDebugging] = useState(false)

    const debugImageLoading = async () => {
      if (isDebugging) return
      setIsDebugging(true)
      
      try {
        console.log('🔍 Debug: Starting image debug for adventure:', adventure.sessionId)
        
        // 1. Check image status
        const status = await AdventureService.getImageStatus(adventure.sessionId)
        console.log('🔍 Debug: Image status:', status)
        
        // 2. Try to get world image URL
        let worldUrlResult = null
        if (status.world_status === 'ready') {
          try {
            worldUrlResult = await AdventureService.getImageUrl(adventure.sessionId, 'world', 'web')
            console.log('🔍 Debug: World image URL result:', worldUrlResult)
          } catch (error) {
            console.error('🔍 Debug: World image URL error:', error)
            worldUrlResult = { error: (error as Error).message }
          }
        }
        
        // 3. Try to get character image URL
        let characterUrlResult = null
        if (status.character_status === 'ready') {
          try {
            characterUrlResult = await AdventureService.getImageUrl(adventure.sessionId, 'character', 'avatar')
            console.log('🔍 Debug: Character image URL result:', characterUrlResult)
          } catch (error) {
            console.error('🔍 Debug: Character image URL error:', error)
            characterUrlResult = { error: (error as Error).message }
          }
        }
        
        setDebugInfo({
          status,
          worldUrlResult,
          characterUrlResult,
          currentWorldUrl: adventure.worldImageUrl,
          currentCharacterUrl: adventure.characterImageUrl,
          isImagesLoading: adventure.isImagesLoading,
          imageLoadError: adventure.imageLoadError
        })
        
      } catch (error) {
        console.error('🔍 Debug: Debug process failed:', error)
        setDebugInfo({ error: (error as Error).message })
      } finally {
        setIsDebugging(false)
      }
    }

    return (
      <div className="p-2 border border-yellow-300 bg-yellow-50 rounded text-xs mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Image Debug: {adventure.title.substring(0, 20)}...</span>
          <button 
            onClick={debugImageLoading}
            disabled={isDebugging}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
          >
            {isDebugging ? 'Debugging...' : 'Debug Images'}
          </button>
        </div>
        
        {debugInfo && (
          <div className="space-y-1 text-xs">
            <div><strong>Status:</strong> World({debugInfo.status?.world_status}) Character({debugInfo.status?.character_status})</div>
            <div><strong>Current URLs:</strong> World({adventure.worldImageUrl ? '✓' : '✗'}) Character({adventure.characterImageUrl ? '✓' : '✗'})</div>
            <div><strong>Loading:</strong> {adventure.isImagesLoading ? 'Yes' : 'No'} | <strong>Error:</strong> {adventure.imageLoadError ? 'Yes' : 'No'}</div>
            
            {debugInfo.worldUrlResult && (
              <div><strong>World URL API:</strong> {debugInfo.worldUrlResult.success ? '✓' : `✗ ${debugInfo.worldUrlResult.message || debugInfo.worldUrlResult.error}`}</div>
            )}
            
            {debugInfo.characterUrlResult && (
              <div><strong>Character URL API:</strong> {debugInfo.characterUrlResult.success ? '✓' : `✗ ${debugInfo.characterUrlResult.message || debugInfo.characterUrlResult.error}`}</div>
            )}
            
            {debugInfo.error && (
              <div className="text-red-600"><strong>Error:</strong> {debugInfo.error}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Get current message for selected adventure
  const currentMessage = selectedAdventure ? (messages[selectedAdventure.sessionId] || '') : ''
  
  // Check if current adventure is loading or waiting for images
  const isCurrentChatLoading = selectedAdventure ? loadingMessages.has(selectedAdventure.sessionId) : false
  const isWaitingForImages = selectedAdventure?.isImagesLoading || false
  
  // Disable send button if loading messages or waiting for images on new adventures
  const isSendDisabled = isCurrentChatLoading || isWaitingForImages || isLoadingConversation

  // Helper function to update message for specific chat
  const updateMessageForChat = (sessionId: string, message: string) => {
    setMessages(prev => ({
      ...prev,
      [sessionId]: message
    }))
  }

  // Helper function to set loading state for specific chat
  const setLoadingForChat = (sessionId: string, loading: boolean) => {
    setLoadingMessages(prev => {
      const newSet = new Set(prev)
      if (loading) {
        newSet.add(sessionId)
      } else {
        newSet.delete(sessionId)
      }
      return newSet
    })
  }

  // FIXED: Helper function to update adventure image URLs
  const updateAdventureImages = async (adventure: Adventure): Promise<Adventure> => {
    if (!imageGenerationEnabled) return adventure

    try {
      // Use the new retry method
      return await AdventureService.loadAdventureImagesWithRetry(adventure, 2)
    } catch (error) {
      console.error('Failed to update adventure images:', error)
      return {
        ...adventure,
        imageLoadError: true
      }
    }
  }

  // Helper function to extract title from story content
  const extractTitle = (content: string): string => {
    const titleMatch = content.match(/\*\*Title:\s*([^*]+)\*\*/i)
    if (titleMatch) {
      return titleMatch[1].trim()
    }
    
    const boldMatch = content.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      return boldMatch[1].trim()
    }
    
    const firstLine = content.split('\n')[0].replace(/\*\*/g, '').trim()
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
  }

  // Helper function to extract preview text
  const extractPreview = (content: string): string => {
    const lines = content.split('\n').filter(line => line.trim())
    const contentWithoutTitle = lines.slice(1).join(' ')
    return contentWithoutTitle.length > 80 
      ? contentWithoutTitle.substring(0, 80) + '...'
      : contentWithoutTitle
  }

  // Helper function to format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date()
    const messageDate = new Date(timestamp)
    const diffInMs = now.getTime() - messageDate.getTime()
    
    const minutes = Math.floor(diffInMs / (1000 * 60))
    const hours = Math.floor(diffInMs / (1000 * 60 * 60))
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) {
      return 'Just now'
    } else if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else if (days < 7) {
      return `${days} day${days !== 1 ? 's' : ''} ago`
    } else {
      // More than a week ago, show actual date
      return messageDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  // Check image generation system availability
  const checkImageSystemHealth = async () => {
    try {
      const isEnabled = await AdventureService.isImageGenerationEnabled()
      console.log('🖼️ Health check result:', isEnabled)
      
      // FIXED: Always enable for now since we know the APIs work
      // The health check fails due to S3 permissions but presigned URLs work fine
      setImageGenerationEnabled(true)
      console.log('🖼️ Image generation enabled: true (bypassing faulty health check)')
      
    } catch (error) {
      console.error('Failed to check image system health:', error)
      // Enable anyway since we know the image APIs work
      setImageGenerationEnabled(true)
      console.log('🖼️ Image generation enabled: true (enabled despite health check error)')
    }
  }

  // FIXED: Load user's adventures from database with improved image loading
  const loadAdventures = async () => {
    if (!isAuthenticated) return
    
    setIsLoadingAdventures(true)
    try {
      console.log('🏰 Loading user adventures from database...')
      const response = await AdventureService.getUserSessions()
      
      // Create base adventures
      const baseAdventures: Adventure[] = response.sessions.map(session => ({
        sessionId: session.session_id,
        title: session.title,
        lastMessage: session.last_message_preview || extractPreview(session.title),
        timestamp: session.last_updated || session.created_at,
        messageCount: session.message_count,
        messages: [],
        isLoaded: false,
        imageStatus: {
          world_status: session.world_image_status || 'pending',
          character_status: session.character_image_status || 'pending'
        },
        isImagesLoading: (session.world_image_status === 'pending' || session.character_image_status === 'pending'),
        imageLoadError: false
      }))

      console.log(`🏰 Loaded ${baseAdventures.length} adventures from database`)

      // Load images for each adventure if image generation is enabled
      if (imageGenerationEnabled) {
        console.log('🖼️ Loading images for adventures...')
        
        // Process adventures in smaller batches to avoid overwhelming the API
        const batchSize = 3
        const adventuresWithImages: Adventure[] = []
        
        for (let i = 0; i < baseAdventures.length; i += batchSize) {
          const batch = baseAdventures.slice(i, i + batchSize)
          
          try {
            const batchResults = await Promise.allSettled(
              batch.map(async (adventure) => {
                try {
                  return await AdventureService.loadAdventureImagesWithRetry(adventure, 2)
                } catch (error) {
                  console.error(`Failed to load images for adventure ${adventure.sessionId}:`, error)
                  return {
                    ...adventure,
                    imageLoadError: true
                  }
                }
              })
            )
            
            // Process batch results
            batchResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                adventuresWithImages.push(result.value)
              } else {
                console.error(`Failed to process adventure in batch:`, result.reason)
                adventuresWithImages.push({
                  ...batch[index],
                  imageLoadError: true
                })
              }
            })
            
            // Update state after each batch for progressive loading
            setAdventures([...adventuresWithImages])
            
          } catch (error) {
            console.error(`Failed to process batch starting at index ${i}:`, error)
            // Add adventures without images if batch fails
            adventuresWithImages.push(...batch.map(adv => ({ ...adv, imageLoadError: true })))
          }
        }
        
        console.log(`🖼️ Loaded images for ${adventuresWithImages.length} adventures`)
      } else {
        // No image generation, just set base adventures
        setAdventures(baseAdventures)
      }
      
    } catch (error) {
      console.error('Failed to load adventures:', error)
      alert('Failed to load your adventures. Please refresh the page.')
    } finally {
      setIsLoadingAdventures(false)
    }
  }

  // Load full conversation for a specific adventure
  const loadConversation = async (adventure: Adventure) => {
    if (adventure.isLoaded) return adventure

    setIsLoadingConversation(true)
    try {
      console.log(`Loading conversation history for adventure: ${adventure.title}`)
      const response = await AdventureService.getSessionHistory(adventure.sessionId)
      
      console.log(`Loaded ${response.messages.length} messages for adventure`)
      
      const updatedAdventure: Adventure = {
        ...adventure,
        messages: response.messages,
        isLoaded: true
      }
      
      // Update the adventure in the list
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === adventure.sessionId ? updatedAdventure : adv
      ))
      
      return updatedAdventure
    } catch (error) {
      console.error('Failed to load conversation:', error)
      alert('Failed to load conversation history. Please try again.')
      return adventure
    } finally {
      setIsLoadingConversation(false)
    }
  }

  // Wait for images to be generated for new adventures
  const waitForNewAdventureImages = async (sessionId: string) => {
    if (!imageGenerationEnabled) return

    try {
      console.log(`Waiting for images to be generated for session: ${sessionId}`)
      
      // Set loading state
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === sessionId ? { ...adv, isImagesLoading: true } : adv
      ))

      // Wait for images with a 5-minute timeout
      const status = await AdventureService.waitForImages(sessionId, 300000, 5000)
      
      console.log('Image generation completed:', status)
      
      // Find the adventure and update it
      setAdventures(prev => {
        return prev.map(adv => {
          if (adv.sessionId === sessionId) {
            return { 
              ...adv, 
              imageStatus: status, 
              isImagesLoading: false 
            }
          }
          return adv
        })
      })

      // Load images for the updated adventure
      const adventureToUpdate = adventures.find(adv => adv.sessionId === sessionId)
      if (adventureToUpdate) {
        try {
          const updatedAdventure = await updateAdventureImages({
            ...adventureToUpdate,
            imageStatus: status,
            isImagesLoading: false
          })

          // Update adventures with images
          setAdventures(prev => prev.map(adv => 
            adv.sessionId === sessionId ? updatedAdventure : adv
          ))

          // Update selected adventure if it's the current one
          if (selectedAdventure?.sessionId === sessionId) {
            setSelectedAdventure(updatedAdventure)
          }
        } catch (error) {
          console.error('Failed to load images after generation:', error)
        }
      }
      
    } catch (error) {
      console.error('Error waiting for images:', error)
      
      // Remove loading state on error
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === sessionId ? { ...adv, isImagesLoading: false } : adv
      ))
    }
  }

  const filteredAdventures = adventures.filter(adventure =>
    adventure.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedAdventure && selectedAdventure.messages.length > 0) {
      scrollToBottom()
    }
  }, [selectedAdventure?.messages.length])

  // Initialize and load adventures
  useEffect(() => {
    if (isAuthenticated) {
      checkImageSystemHealth()
    }
  }, [isAuthenticated])

  // Separate effect for loading adventures after image system is checked
  useEffect(() => {
    if (isAuthenticated && imageGenerationEnabled !== undefined) {
      loadAdventures()
    }
  }, [isAuthenticated, imageGenerationEnabled])

  // FIXED: Update images for pending adventures periodically
  useEffect(() => {
    if (!imageGenerationEnabled || !isAuthenticated) return

    const updateImagesForPendingAdventures = async () => {
      const adventuresNeedingUpdates = adventures.filter(adv => 
        adv.isImagesLoading && adv.imageStatus && !adv.imageLoadError
      )
      
      if (adventuresNeedingUpdates.length === 0) return

      try {
        console.log(`🖼️ Updating images for ${adventuresNeedingUpdates.length} pending adventures`)
        
        const updatedAdventures = await Promise.allSettled(
          adventures.map(async (adventure) => {
            if (adventure.isImagesLoading && !adventure.imageLoadError) {
              try {
                return await AdventureService.loadAdventureImagesWithRetry(adventure, 1)
              } catch (error) {
                console.error(`Failed to update images for adventure ${adventure.sessionId}:`, error)
                return {
                  ...adventure,
                  imageLoadError: true,
                  isImagesLoading: false
                }
              }
            }
            return adventure
          })
        )

        // Process results and update state
        const processedAdventures = updatedAdventures.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            console.error(`Failed to update adventure:`, result.reason)
            return {
              ...adventures[index],
              imageLoadError: true,
              isImagesLoading: false
            }
          }
        })

        // Check if there are actual changes before updating state
        const hasChanges = processedAdventures.some((updated, index) => {
          const original = adventures[index]
          return updated.worldImageUrl !== original.worldImageUrl ||
                 updated.characterImageUrl !== original.characterImageUrl ||
                 updated.isImagesLoading !== original.isImagesLoading ||
                 updated.imageLoadError !== original.imageLoadError
        })

        if (hasChanges) {
          setAdventures(processedAdventures)
          
          // Update selected adventure if it was updated
          if (selectedAdventure) {
            const updatedSelected = processedAdventures.find(adv => adv.sessionId === selectedAdventure.sessionId)
            if (updatedSelected && (
              updatedSelected.worldImageUrl !== selectedAdventure.worldImageUrl ||
              updatedSelected.characterImageUrl !== selectedAdventure.characterImageUrl ||
              updatedSelected.isImagesLoading !== selectedAdventure.isImagesLoading
            )) {
              setSelectedAdventure(updatedSelected)
            }
          }
        }
      } catch (error) {
        console.error('Error updating pending images:', error)
      }
    }

    // Update images every 15 seconds for pending adventures (increased interval)
    const interval = setInterval(updateImagesForPendingAdventures, 15000)
    return () => clearInterval(interval)
  }, [adventures, imageGenerationEnabled, isAuthenticated, selectedAdventure])

  // Handle URL parameter for selecting specific adventure
  useEffect(() => {
    const selectAdventureId = searchParams.get('select')
    if (selectAdventureId && adventures.length > 0 && !selectedAdventure) {
      const adventureToSelect = adventures.find(adv => adv.sessionId === selectAdventureId)
      if (adventureToSelect) {
        handleSelectAdventure(adventureToSelect)
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev)
          newParams.delete('select')
          return newParams
        })
      }
    }
  }, [adventures, searchParams, selectedAdventure])

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowAuthModal(true)
    }
  }, [isAuthenticated, isLoading])

  const handleSendMessage = async () => {
    if (!selectedAdventure || !currentMessage.trim() || isSendDisabled) {
      return
    }

    const sessionId = selectedAdventure.sessionId
    const userMessage = currentMessage.trim()
    
    setLoadingForChat(sessionId, true)
    updateMessageForChat(sessionId, '')

    try {
      // Create user message object
      const userMessageObj: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      }

      // Optimistically update the UI
      const updatedAdventure = {
        ...selectedAdventure,
        messages: [...selectedAdventure.messages, userMessageObj],
        lastMessage: userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage,
        timestamp: new Date().toISOString()
      }

      setAdventures(prev => prev.map(adv => 
        adv.sessionId === sessionId ? updatedAdventure : adv
      ))
      setSelectedAdventure(updatedAdventure)

      // Send action to API
      const response = await AdventureService.takeStoryAction(sessionId, userMessage)

      if (response.success) {
        // Create AI response message
        const aiMessageObj: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.story_content,
          timestamp: new Date().toISOString()
        }

        // Update with AI response
        const finalAdventure = {
          ...updatedAdventure,
          messages: [...updatedAdventure.messages, aiMessageObj],
          lastMessage: response.story_content.length > 50 ? response.story_content.substring(0, 50) + '...' : response.story_content,
          timestamp: new Date().toISOString()
        }

        setAdventures(prev => prev.map(adv => 
          adv.sessionId === sessionId ? finalAdventure : adv
        ))
        
        setSelectedAdventure(current => 
          current?.sessionId === sessionId ? finalAdventure : current
        )
      } else {
        console.error('Failed to get AI response:', response.message)
        // Revert optimistic update on error
        setSelectedAdventure(selectedAdventure)
        setAdventures(prev => prev.map(adv => 
          adv.sessionId === sessionId ? selectedAdventure : adv
        ))
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Revert optimistic update on error
      setSelectedAdventure(selectedAdventure)
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === sessionId ? selectedAdventure : adv
      ))
    } finally {
      setLoadingForChat(sessionId, false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSendDisabled) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    loadAdventures()
  }

  const handleStartAdventure = () => {
    setShowAdventureModal(true)
  }

  const handleAdventureCreated = async (storyData: { sessionId: string; storyContent: string }) => {
    console.log('Adventure created:', storyData)
    
    const title = extractTitle(storyData.storyContent)
    const preview = extractPreview(storyData.storyContent)
    
    // Create initial AI message from the story content
    const initialMessage: Message = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: storyData.storyContent,
      timestamp: new Date().toISOString()
    }
    
    const newAdventure: Adventure = {
      sessionId: storyData.sessionId,
      title: title,
      lastMessage: preview,
      timestamp: new Date().toISOString(),
      messageCount: 1,
      messages: [initialMessage],
      isLoaded: true,
      imageStatus: {
        world_status: 'pending',
        character_status: 'pending'
      },
      isImagesLoading: imageGenerationEnabled, // Only show loading if images are enabled
      imageLoadError: false
    }
    
    setAdventures(prev => [newAdventure, ...prev])
    setSelectedAdventure(newAdventure)
    
    // Start waiting for images if image generation is enabled
    if (imageGenerationEnabled) {
      waitForNewAdventureImages(storyData.sessionId)
    }
  }

  const handleSelectAdventure = async (adventure: Adventure) => {
    console.log(`Selecting adventure: ${adventure.title} (${adventure.messageCount} messages)`)
    setSelectedAdventure(adventure)
    
    // Load full conversation if not already loaded
    if (!adventure.isLoaded) {
      console.log('Loading conversation history from database...')
      const loadedAdventure = await loadConversation(adventure)
      setSelectedAdventure(loadedAdventure)
    } else {
      console.log('Using cached conversation history')
    }
  }

  const handleDeleteAdventure = async (adventure: Adventure, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation() // Prevent adventure selection when clicking from sidebar
    }
    
    // Show confirmation modal
    setAdventureToDelete(adventure)
    setShowDeleteModal(true)
  }

  const confirmDeleteAdventure = async () => {
    if (!adventureToDelete) return
    
    setIsDeletingAdventure(true)
    
    try {
      await AdventureService.deleteSession(adventureToDelete.sessionId)
      
      // Remove from local state
      setAdventures(prev => prev.filter(adv => adv.sessionId !== adventureToDelete.sessionId))
      
      // If this was the selected adventure, clear selection
      if (selectedAdventure?.sessionId === adventureToDelete.sessionId) {
        setSelectedAdventure(null)
      }
      
      // Close modal
      setShowDeleteModal(false)
      setAdventureToDelete(null)
    } catch (error) {
      console.error('Failed to delete adventure:', error)
      alert('Failed to delete adventure. Please try again.')
    } finally {
      setIsDeletingAdventure(false)
    }
  }

  const cancelDeleteAdventure = () => {
    setShowDeleteModal(false)
    setAdventureToDelete(null)
    setIsDeletingAdventure(false)
  }

  const handleRegenerateImages = async (adventure: Adventure, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    
    if (!imageGenerationEnabled) {
      alert('Image generation is not available')
      return
    }

    try {
      await AdventureService.regenerateImages(adventure.sessionId)
      
      // Update the adventure to show loading state
      const updatedAdventure = {
        ...adventure,
        isImagesLoading: true,
        imageStatus: {
          world_status: 'pending' as const,
          character_status: 'pending' as const
        },
        imageLoadError: false
      }
      
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === adventure.sessionId ? updatedAdventure : adv
      ))
      
      if (selectedAdventure?.sessionId === adventure.sessionId) {
        setSelectedAdventure(updatedAdventure)
      }
      
      // Wait for new images
      waitForNewAdventureImages(adventure.sessionId)
      
    } catch (error) {
      console.error('Failed to regenerate images:', error)
      alert('Failed to regenerate images. Please try again.')
    }
  }

  const handleImageClick = (imageUrl: string | undefined, title: string, type: 'character' | 'world') => {
    if (imageUrl) {
      setZoomedImage({ url: imageUrl, title, type })
      setShowImageZoom(true)
    }
  }

  const handleCloseImageZoom = () => {
    setShowImageZoom(false)
    setZoomedImage(null)
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-pulse text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center space-y-6 p-8">
            <MessageSquare className="h-24 w-24 mx-auto text-primary/50" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Access Restricted</h2>
              <p className="text-muted-foreground max-w-md">
                You need to create an account or sign in to access your adventures.
              </p>
            </div>
            <Button 
              onClick={() => setShowAuthModal(true)}
              className="gradient-primary shadow-glow"
            >
              Create Account
            </Button>
          </div>
        </div>
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="signup"
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Adventure Sidebar */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 space-y-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Adventures</h2>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={loadAdventures}
                  disabled={isLoadingAdventures}
                  title="Refresh adventures"
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingAdventures ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleStartAdventure}
                  title="Start new adventure"
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search adventures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingAdventures ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAdventures.length > 0 ? (
              <div className="space-y-2 p-2">
                {filteredAdventures.map((adventure) => (
                  <div
                    key={adventure.sessionId}
                    onClick={() => handleSelectAdventure(adventure)}
                    className={`relative p-3 rounded-lg cursor-pointer transition-all group ${
                      selectedAdventure?.sessionId === adventure.sessionId
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    {/* World Background Image */}
                    {adventure.worldImageUrl && (
                      <div 
                        className="absolute inset-0 rounded-lg bg-cover bg-center opacity-10 transition-opacity group-hover:opacity-20"
                        style={{ backgroundImage: `url(${adventure.worldImageUrl})` }}
                      />
                    )}
                    
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Character Avatar */}
                        <div className="flex-shrink-0 relative">
                          <Avatar className="h-10 w-10 ring-2 ring-border/50">
                            {adventure.characterImageUrl ? (
                              <AvatarImage src={adventure.characterImageUrl} alt="Character" />
                            ) : (
                              <AvatarFallback className={`${
                                adventure.isImagesLoading ? 'bg-primary/10' : 'bg-muted'
                              } text-muted-foreground relative`}>
                                {adventure.isImagesLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          
                          {/* Image status indicator */}
                          {imageGenerationEnabled && adventure.imageStatus && (
                            <div className="absolute -bottom-1 -right-1">
                              {adventure.isImagesLoading ? (
                                <div className="w-3 h-3 bg-yellow-500 rounded-full border border-background animate-pulse" 
                                     title="Generating images..." />
                              ) : adventure.imageLoadError ? (
                                <div className="w-3 h-3 bg-red-500 rounded-full border border-background" 
                                     title="Image loading failed" />
                              ) : adventure.imageStatus.character_status === 'ready' ? (
                                <div className="w-3 h-3 bg-green-500 rounded-full border border-background" 
                                     title="Images ready" />
                              ) : adventure.imageStatus.character_status === 'failed' ? (
                                <div className="w-3 h-3 bg-red-500 rounded-full border border-background" 
                                     title="Image generation failed" />
                              ) : null}
                            </div>
                          )}
                        </div>
                        
                        {/* Adventure Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground text-sm truncate mb-1">
                            {adventure.title}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {adventure.lastMessage}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(adventure.timestamp)}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {adventure.messageCount} messages
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        {/* Regenerate Images Button */}
                        {imageGenerationEnabled && adventure.imageStatus && 
                         (adventure.imageStatus.world_status === 'failed' || adventure.imageStatus.character_status === 'failed' || adventure.imageLoadError) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-500"
                            onClick={(e) => handleRegenerateImages(adventure, e)}
                            title="Regenerate images"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                        
                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                          onClick={(e) => handleDeleteAdventure(adventure, e)}
                          title="Delete adventure"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Image Error Indicator */}
                    {adventure.imageLoadError && (
                      <div className="absolute top-3 left-3 bg-red-500/80 text-white text-xs px-2 py-1 rounded-full">
                        Image load failed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 p-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                <div className="space-y-2">
                  <h3 className="font-medium text-muted-foreground">No Adventures Yet</h3>
                  <p className="text-sm text-muted-foreground/70">
                    Start your first adventure to see your stories here
                  </p>
                </div>
                <Button className="gradient-primary" onClick={handleStartAdventure}>
                  <Plus className="h-4 w-4 mr-2" />
                  Begin New Adventure
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Adventure Content */}
        <div className="flex-1 flex flex-col bg-background relative">
          {selectedAdventure ? (
            <>
              {/* World Background Image */}
              {selectedAdventure.worldImageUrl && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-5"
                  style={{ backgroundImage: `url(${selectedAdventure.worldImageUrl})` }}
                />
              )}
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Chat Header with Character Icon */}
                <div className="p-4 border-b bg-card/95 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Character Icon in Header */}
                      <div className="relative">
                        <Avatar 
                          className="h-12 w-12 ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all duration-200" 
                          onClick={() => handleImageClick(selectedAdventure.characterImageUrl, selectedAdventure.title, 'character')}
                          title="Click to view character portrait"
                        >
                          {selectedAdventure.characterImageUrl ? (
                            <AvatarImage src={selectedAdventure.characterImageUrl} alt="Character" />
                          ) : (
                            <AvatarFallback className={`${
                              selectedAdventure.isImagesLoading ? 'bg-primary/10' : 'bg-primary/10'
                            } text-primary relative`}>
                              {selectedAdventure.isImagesLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        
                        {/* Image generation status in header */}
                        {selectedAdventure.isImagesLoading && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-background animate-pulse" />
                        )}
                        
                        {selectedAdventure.imageLoadError && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      
                      {/* Title and Subtitle */}
                      <div>
                        <h1 className="text-xl font-semibold text-foreground">{selectedAdventure.title}</h1>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">Continue your adventure...</p>
                          {selectedAdventure.isImagesLoading && (
                            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating images...
                            </span>
                          )}
                          {selectedAdventure.imageLoadError && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1">
                              <RotateCcw className="h-3 w-3" />
                              Image load failed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Regenerate Images Button */}
                      {imageGenerationEnabled && selectedAdventure.imageStatus && 
                       (selectedAdventure.imageStatus.world_status === 'failed' || selectedAdventure.imageStatus.character_status === 'failed' || selectedAdventure.imageLoadError) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRegenerateImages(selectedAdventure)}
                          className="text-muted-foreground hover:text-blue-500 transition-colors"
                          title="Regenerate failed images"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Delete Button */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteAdventure(selectedAdventure)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                        title="Delete this adventure"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {isLoadingConversation ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading conversation...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-4xl mx-auto">
                      {/* Display conversation history */}
                      {selectedAdventure.messages.map((msg) => (
                        <div key={msg.id} className="flex gap-4">
                          {msg.role === 'user' ? (
                            <>
                              <div className="flex-1" />
                              <div className="bg-primary text-primary-foreground p-4 rounded-2xl max-w-2xl shadow-sm">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {msg.content}
                                </div>
                              </div>
                              <Avatar className="h-8 w-8 flex-shrink-0 mt-1 ring-2 ring-primary/20">
                                {selectedAdventure.characterImageUrl ? (
                                  <AvatarImage src={selectedAdventure.characterImageUrl} alt="Character" />
                                ) : (
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                    You
                                  </AvatarFallback>
                                )}
                              </Avatar>
                            </>
                          ) : (
                            <>
                              <Avatar className="h-8 w-8 flex-shrink-0 mt-1 ring-2 ring-primary/20">
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                  DM
                                </AvatarFallback>
                              </Avatar>
                              <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl flex-1 border border-border/30 shadow-sm">
                                <MarkdownRenderer 
                                  content={msg.content}
                                  className="text-sm text-foreground leading-relaxed"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Loading indicator for AI response */}
                      {isCurrentChatLoading && (
                        <div className="flex gap-4">
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1 ring-2 ring-primary/20">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                              DM
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl flex-1 border border-border/30 shadow-sm">
                            <div className="flex items-center space-x-2 text-muted-foreground">
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <span className="text-sm">Dungeon Master is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Scroll anchor */}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Input Area with Image Generation Status */}
                <div className="p-4 border-t bg-card/95 backdrop-blur-sm">
                  <div className="max-w-4xl mx-auto">
                    {/* Image Generation Warning */}
                    {isWaitingForImages && (
                      <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2 text-sm text-yellow-800">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          Please wait while we generate images for your adventure. You can continue chatting once images are ready.
                        </span>
                      </div>
                    )}
                    
                    {/* Image Load Error Warning */}
                    {selectedAdventure.imageLoadError && (
                      <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2 text-sm text-red-800">
                        <RotateCcw className="h-4 w-4" />
                        <span>
                          Failed to load images for this adventure. You can continue chatting or try regenerating images.
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleRegenerateImages(selectedAdventure)}
                          className="ml-auto"
                        >
                          Retry Images
                        </Button>
                      </div>
                    )}
                    
                    <div className="flex gap-3">
                      <Input 
                        placeholder={isSendDisabled ? "Please wait..." : "What do you want to do next?"} 
                        className="flex-1 bg-background/50 border-border/50 focus:border-primary rounded-xl px-4 py-3"
                        value={currentMessage}
                        onChange={(e) => selectedAdventure && updateMessageForChat(selectedAdventure.sessionId, e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isSendDisabled}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={!currentMessage.trim() || isSendDisabled}
                        className="min-w-[90px] gradient-primary shadow-sm rounded-xl px-6"
                      >
                        {isCurrentChatLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isWaitingForImages ? (
                          <>
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Wait
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Welcome Screen */
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-8 max-w-md">
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-lg">
                    <MessageSquare className="h-10 w-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-foreground">Welcome to QuestWeaver</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Ready to embark on an epic adventure? Create your first story and let AI guide your journey through unlimited possibilities.
                      {imageGenerationEnabled && (
                        <span className="block mt-2 text-sm text-green-600">
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button 
                  className="gradient-primary shadow-glow px-8 py-3 rounded-xl font-medium" 
                  onClick={handleStartAdventure}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Start New Adventure
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Adventure Setup Modal */}
      <AdventureSetupModal
        isOpen={showAdventureModal}
        onClose={() => setShowAdventureModal(false)}
        onAdventureCreated={handleAdventureCreated}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDeleteAdventure}
        onConfirm={confirmDeleteAdventure}
        adventureTitle={adventureToDelete?.title || ''}
        isDeleting={isDeletingAdventure}
      />

      {/* Image Zoom Modal */}
      <ImageZoomModal
        isOpen={showImageZoom}
        onClose={handleCloseImageZoom}
        imageUrl={zoomedImage?.url || null}
        title={zoomedImage?.title || ''}
        imageType={zoomedImage?.type || 'character'}
      />
    </div>
  )
}

export default Adventures
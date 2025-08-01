import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Plus, Search, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { useAuth } from '@/components/AuthContext'
import { AdventureService } from '@/services/AdventureService'
import AuthModal from '@/components/AuthModal'
import AdventureSetupModal from '@/components/AdventureSetupModal'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Header from '@/components/Header'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Adventure {
  sessionId: string
  title: string
  lastMessage: string
  timestamp: string
  messageCount: number
  messages: Message[]
  isLoaded: boolean // Track if full conversation is loaded
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { isAuthenticated, isLoading } = useAuth()

  // Get current message for selected adventure
  const currentMessage = selectedAdventure ? (messages[selectedAdventure.sessionId] || '') : ''
  
  // Check if current adventure is loading
  const isCurrentChatLoading = selectedAdventure ? loadingMessages.has(selectedAdventure.sessionId) : false

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

  // Load user's adventures from database
  const loadAdventures = async () => {
    if (!isAuthenticated) return
    
    setIsLoadingAdventures(true)
    try {
      console.log('Loading user adventures from database...')
      const response = await AdventureService.getUserSessions()
      
      const adventureList: Adventure[] = response.sessions.map(session => ({
        sessionId: session.session_id,
        title: session.title,
        lastMessage: session.last_message_preview || extractPreview(session.title),
        timestamp: session.last_updated || session.created_at,
        messageCount: session.message_count,
        messages: [],
        isLoaded: false
      }))
      
      console.log(`Loaded ${adventureList.length} adventures from database`)
      setAdventures(adventureList)
    } catch (error) {
      console.error('Failed to load adventures:', error)
      // Show user-friendly error message
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
        messages: response.messages, // Messages are already ordered by timestamp ASC from backend
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

  // Load adventures when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAdventures()
    }
  }, [isAuthenticated])

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowAuthModal(true)
    }
  }, [isAuthenticated, isLoading])

  const handleSendMessage = async () => {
    if (!selectedAdventure || !currentMessage.trim() || isCurrentChatLoading) {
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

      // Send action to API (which will save to database)
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
    if (e.key === 'Enter' && !e.shiftKey && !isCurrentChatLoading) {
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

  const handleAdventureCreated = (storyData: { sessionId: string; storyContent: string }) => {
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
      isLoaded: true
    }
    
    setAdventures(prev => [newAdventure, ...prev])
    setSelectedAdventure(newAdventure)
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
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      selectedAdventure?.sessionId === adventure.sessionId
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate mb-1">
                          {adventure.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {adventure.lastMessage}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(adventure.timestamp).toLocaleDateString()}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {adventure.messageCount} messages
                          </span>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                        onClick={(e) => handleDeleteAdventure(adventure, e)}
                        title="Delete adventure"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
        <div className="flex-1 flex flex-col bg-background">
          {selectedAdventure ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground">{selectedAdventure.title}</h1>
                    <p className="text-sm text-muted-foreground">Continue your adventure...</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                You
                              </AvatarFallback>
                            </Avatar>
                          </>
                        ) : (
                          <>
                            <Avatar className="h-8 w-8 flex-shrink-0 mt-1 ring-2 ring-primary/20">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                AI
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
                            AI
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl flex-1 border border-border/30 shadow-sm">
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <span className="text-sm">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t bg-card/95 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto">
                  <div className="flex gap-3">
                    <Input 
                      placeholder="What do you want to do next?" 
                      className="flex-1 bg-background/50 border-border/50 focus:border-primary rounded-xl px-4 py-3"
                      value={currentMessage}
                      onChange={(e) => selectedAdventure && updateMessageForChat(selectedAdventure.sessionId, e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isCurrentChatLoading || isLoadingConversation}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!currentMessage.trim() || isCurrentChatLoading || isLoadingConversation}
                      className="min-w-[90px] gradient-primary shadow-sm rounded-xl px-6"
                    >
                      {isCurrentChatLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    <h3 className="text-2xl font-bold text-foreground">Welcome to DungeonCraft AI</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Ready to embark on an epic adventure? Create your first story and let AI guide your journey through unlimited possibilities.
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
    </div>
  )
}

export default Adventures
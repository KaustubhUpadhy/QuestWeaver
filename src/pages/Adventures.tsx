import { useState, useEffect } from 'react'
import { MessageSquare, Plus, Settings, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { useAuth } from '@/components/AuthContext'
import { AdventureService } from '@/services/AdventureService'
import AuthModal from '@/components/AuthModal'
import AdventureSetupModal from '@/components/AdventureSetupModal'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Header from '@/components/Header'

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: string
}

interface Adventure {
  sessionId: string
  title: string
  lastMessage: string
  timestamp: string
  storyContent: string
  messages: Message[]
}

const Adventures = () => {
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<{ [sessionId: string]: string }>({}) // Per-chat message state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAdventureModal, setShowAdventureModal] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set()) // Per-chat loading state
  
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
    // Look for **Title: something** pattern
    const titleMatch = content.match(/\*\*Title:\s*([^*]+)\*\*/i)
    if (titleMatch) {
      return titleMatch[1].trim()
    }
    
    // Look for any text between ** at the beginning
    const boldMatch = content.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      return boldMatch[1].trim()
    }
    
    // Fallback: take first line and limit length
    const firstLine = content.split('\n')[0].replace(/\*\*/g, '').trim()
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
  }

  // Helper function to extract preview text (non-title content)
  const extractPreview = (content: string): string => {
    // Remove title line and get preview
    const lines = content.split('\n').filter(line => line.trim())
    const contentWithoutTitle = lines.slice(1).join(' ')
    return contentWithoutTitle.length > 80 
      ? contentWithoutTitle.substring(0, 80) + '...'
      : contentWithoutTitle
  }

  const filteredAdventures = adventures.filter(adventure =>
    adventure.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    
    // Set loading state for this specific chat
    setLoadingForChat(sessionId, true)
    
    // Clear input for this specific chat immediately
    updateMessageForChat(sessionId, '')

    try {
      // Create user message
      const userMessageObj: Message = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      }

      // Add user message to the adventure
      const updatedAdventure = {
        ...selectedAdventure,
        messages: [...selectedAdventure.messages, userMessageObj],
        lastMessage: userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage,
        timestamp: new Date().toISOString()
      }

      // Update adventures list and selected adventure
      setAdventures(prev => prev.map(adv => 
        adv.sessionId === sessionId ? updatedAdventure : adv
      ))
      setSelectedAdventure(updatedAdventure)

      // Send action to API
      console.log('Sending action to API:', sessionId, userMessage)
      const response = await AdventureService.takeStoryAction(sessionId, userMessage)

      if (response.success) {
        // Create AI response message
        const aiMessageObj: Message = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: response.story_content,
          timestamp: new Date().toISOString()
        }

        // Add AI response to the adventure
        const finalAdventure = {
          ...updatedAdventure,
          messages: [...updatedAdventure.messages, aiMessageObj],
          lastMessage: response.story_content.length > 50 ? response.story_content.substring(0, 50) + '...' : response.story_content,
          timestamp: new Date().toISOString()
        }

        // Update adventures list and selected adventure
        setAdventures(prev => prev.map(adv => 
          adv.sessionId === sessionId ? finalAdventure : adv
        ))
        
        // Only update selected adventure if this chat is still selected
        setSelectedAdventure(current => 
          current?.sessionId === sessionId ? finalAdventure : current
        )
        
        console.log('AI response received:', response)
      } else {
        console.error('Failed to get AI response:', response.message)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      // Remove loading state for this specific chat
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
  }

  const handleStartAdventure = () => {
    setShowAdventureModal(true)
  }

  const handleAdventureCreated = (storyData: { sessionId: string; storyContent: string }) => {
    console.log('Adventure created:', storyData)
    
    // Extract proper title from story content
    const title = extractTitle(storyData.storyContent)
    const preview = extractPreview(storyData.storyContent)
    
    // Create new adventure object with empty messages array
    const newAdventure: Adventure = {
      sessionId: storyData.sessionId,
      title: title,
      lastMessage: preview,
      timestamp: new Date().toISOString(),
      storyContent: storyData.storyContent,
      messages: [] // Initialize empty conversation history
    }
    
    // Add to adventures list
    setAdventures(prev => [newAdventure, ...prev])
    
    // Select the new adventure
    setSelectedAdventure(newAdventure)
    
    console.log('New adventure added to list:', newAdventure)
  }

  const handleSelectAdventure = (adventure: Adventure) => {
    setSelectedAdventure(adventure)
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
        <div className="w-80 border-r bg-card">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Adventures</h2>
              <Button size="sm" variant="ghost" onClick={handleStartAdventure}>
                <Plus className="h-4 w-4" />
              </Button>
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

          <div className="h-full overflow-y-auto pb-4">
            {filteredAdventures.length > 0 ? (
              <div className="space-y-2 p-2">
                {filteredAdventures.map((adventure) => (
                  <div
                    key={adventure.sessionId}
                    onClick={() => handleSelectAdventure(adventure)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedAdventure?.sessionId === adventure.sessionId
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-muted/20'
                    }`}
                  >
                    <h3 className="font-medium text-foreground text-sm truncate mb-1">
                      {adventure.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {adventure.lastMessage}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(adventure.timestamp).toLocaleDateString()}
                    </p>
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
        <div className="flex-1 flex flex-col">
          {selectedAdventure ? (
            <>
              <div className="p-4 border-b bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold">{selectedAdventure.title}</h1>
                    <p className="text-sm text-muted-foreground">Continue your adventure...</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-background">
                <div className="space-y-4 max-w-5xl">
                  {/* Display the initial story content */}
                  <div className="flex gap-4">
                    <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                      <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-card/50 p-6 rounded-lg flex-1 border border-border/50 backdrop-blur-sm">
                      <MarkdownRenderer 
                        content={selectedAdventure.storyContent}
                        className="text-sm text-foreground leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Display conversation history */}
                  {selectedAdventure.messages.map((msg) => (
                    <div key={msg.id} className="flex gap-4">
                      {msg.type === 'user' ? (
                        <>
                          <div className="flex-1" />
                          <div className="bg-primary text-primary-foreground p-4 rounded-lg max-w-2xl">
                            <div className="text-sm leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                            <AvatarFallback className="bg-foreground text-background">You</AvatarFallback>
                          </Avatar>
                        </>
                      ) : (
                        <>
                          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                            <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                          </Avatar>
                          <div className="bg-card/50 p-6 rounded-lg flex-1 border border-border/50 backdrop-blur-sm">
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
                      <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                      </Avatar>
                      <div className="bg-card/50 p-6 rounded-lg flex-1 border border-border/50 backdrop-blur-sm">
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-sm">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t bg-card/95 backdrop-blur-sm">
                <div className="flex gap-2">
                  <Input 
                    placeholder="What do you want to do next?" 
                    className="flex-1"
                    value={currentMessage}
                    onChange={(e) => selectedAdventure && updateMessageForChat(selectedAdventure.sessionId, e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isCurrentChatLoading}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!currentMessage.trim() || isCurrentChatLoading}
                    className="min-w-[80px]"
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-6">
                <MessageSquare className="h-16 w-16 mx-auto opacity-50" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Welcome to DungeonCraft AI</h3>
                  <p className="text-muted-foreground max-w-md">
                    Ready to embark on an epic adventure? Create your first story and let AI guide your journey through unlimited possibilities.
                  </p>
                </div>
                <Button className="gradient-primary shadow-glow" onClick={handleStartAdventure}>
                  <Plus className="h-4 w-4 mr-2" />
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
    </div>
  )
}

export default Adventures
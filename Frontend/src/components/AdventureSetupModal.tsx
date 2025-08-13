import { useState } from 'react'
import { X, Sparkles, Scroll, User, Globe, Zap, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AdventureService } from '@/services/AdventureService'

interface AdventureSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onAdventureCreated?: (storyData: { sessionId: string; storyContent: string }) => void
}

interface AdventureData {
  genre: string
  character: string
  worldAdditions: string
  actions: 'yes' | 'no'
}

const AdventureSetupModal = ({ isOpen, onClose, onAdventureCreated }: AdventureSetupModalProps) => {
  const [formData, setFormData] = useState<AdventureData>({
    genre: '',
    character: '',
    worldAdditions: '',
    actions: 'yes'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    
    setIsLoading(true)
    setError(null)

    try {
      console.log('Starting adventure with data:', formData)
      
      // Call the API to initialize the story
      const response = await AdventureService.initializeStory({
        genre: formData.genre,
        character: formData.character,
        worldAdditions: formData.worldAdditions,
        actions: formData.actions
      })

      if (response.success) {
        console.log('Adventure created successfully:', response)
        
        // Pass the story data to parent component
        onAdventureCreated?.({
          sessionId: response.session_id,
          storyContent: response.story_content
        })
        
        // Reset form and close modal
        setFormData({
          genre: '',
          character: '',
          worldAdditions: '',
          actions: 'yes'
        })
        onClose()
      } else {
        throw new Error(response.message || 'Failed to create adventure')
      }
    } catch (error) {
      console.error('Failed to create adventure:', error)
      setError(error instanceof Error ? error.message : 'Failed to create adventure. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof AdventureData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) setError(null)
  }

  const handleActionsChange = (value: 'yes' | 'no') => {
    setFormData(prev => ({ ...prev, actions: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isLoading ? onClose : undefined}
      />
      
      
      <div className="relative w-full max-w-lg mx-4">
        <div className="bg-gradient-to-b from-primary/20 to-primary/10 p-6 rounded-2xl border border-primary/30 shadow-2xl backdrop-blur-xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>

          
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="p-2.5 bg-gradient-to-br from-primary to-lime-400 rounded-full shadow-glow">
                <Scroll className="h-6 w-6 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Craft Your Adventure
            </h2>
            <p className="text-muted-foreground">
              Tell us about the story you want to experience
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}

          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Genre Field */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">
                  Genre (Optional)
                </label>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Enter what genre(s) you want the story to be
              </p>
              <Input
                type="text"
                value={formData.genre}
                onChange={(e) => handleInputChange('genre', e.target.value)}
                placeholder="Fantasy, Sci-fi, Horror, Mystery, Adventure..."
                className="bg-background/50 border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                disabled={isLoading}
              />
            </div>

            {/* Character Field */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">
                  Character (Optional)
                </label>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Enter the character you want to play (name, role, lore, etc.)
              </p>
              <textarea
                value={formData.character}
                onChange={(e) => handleInputChange('character', e.target.value)}
                placeholder="A brave knight named Sir Gareth, sworn to protect the realm..."
                className="w-full bg-background/50 border border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/60 resize-none text-sm"
                rows={2}
                disabled={isLoading}
              />
            </div>

            {/* World Additions Field */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">
                  World Details (Optional)
                </label>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Enter any extra world information (factions, locations, details)
              </p>
              <textarea
                value={formData.worldAdditions}
                onChange={(e) => handleInputChange('worldAdditions', e.target.value)}
                placeholder="The kingdom of Eldoria is at war with the Shadow Lords..."
                className="w-full bg-background/50 border border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/60 resize-none text-sm"
                rows={2}
                disabled={isLoading}
              />
            </div>

            {/* Actions Field */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold text-foreground">
                  Action Suggestions *
                </label>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Do you want possible actions given after each response?
              </p>
              
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="radio"
                      name="actions"
                      value="yes"
                      checked={formData.actions === 'yes'}
                      onChange={() => handleActionsChange('yes')}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                      formData.actions === 'yes' 
                        ? 'border-primary bg-primary shadow-glow' 
                        : 'border-muted-foreground group-hover:border-primary/60'
                    }`}>
                      {formData.actions === 'yes' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <span className={`text-sm transition-colors ${
                    formData.actions === 'yes' ? 'text-primary font-medium' : 'text-foreground'
                  }`}>
                    Yes
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="radio"
                      name="actions"
                      value="no"
                      checked={formData.actions === 'no'}
                      onChange={() => handleActionsChange('no')}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                      formData.actions === 'no' 
                        ? 'border-primary bg-primary shadow-glow' 
                        : 'border-muted-foreground group-hover:border-primary/60'
                    }`}>
                      {formData.actions === 'no' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <span className={`text-sm transition-colors ${
                    formData.actions === 'no' ? 'text-primary font-medium' : 'text-foreground'
                  }`}>
                    No
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full gradient-primary text-white font-bold py-3 rounded-xl shadow-glow hover:shadow-elegant transition-all duration-300 transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Adventure...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Sparkles className="h-5 w-5" />
                    <span>Start My Adventure</span>
                  </div>
                )}
              </Button>
            </div>
          </form>

          {/* Footer Hint */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground/70">
              ✨ Your adventure will be uniquely crafted by AI based on your preferences
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdventureSetupModal
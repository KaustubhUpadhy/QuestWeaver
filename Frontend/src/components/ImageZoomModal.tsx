import { useState, useEffect } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ImageZoomModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string | null
  title: string
  imageType: 'character' | 'world'
}

const ImageZoomModal = ({ isOpen, onClose, imageUrl, title, imageType }: ImageZoomModalProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (isOpen && imageUrl) {
      setIsLoading(true)
      setHasError(false)
    }
  }, [isOpen, imageUrl])


  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !imageUrl) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-[90vw] max-h-[90vh] bg-background rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <h3 className="font-semibold text-foreground">
              {imageType === 'character' ? 'Character Portrait' : 'World View'}: {title}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex items-center justify-center min-h-[400px] max-h-[70vh] bg-muted/20">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading image...</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                <RotateCcw className="h-12 w-12 text-red-500 mx-auto" />
                <div>
                  <h4 className="font-medium text-foreground mb-2">Failed to load image</h4>
                  <p className="text-sm text-muted-foreground">The image couldn't be loaded. It may have expired or been moved.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsLoading(true)
                    setHasError(false)
                    // Force reload by adding timestamp
                    const img = document.querySelector('.zoom-modal-image') as HTMLImageElement
                    if (img) {
                      img.src = img.src.split('?')[0] + '?t=' + Date.now()
                    }
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <img
            src={imageUrl}
            alt={`${imageType === 'character' ? 'Character' : 'World'} from ${title}`}
            className={`zoom-modal-image max-w-full max-h-full object-contain transition-opacity duration-200 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: hasError ? 'none' : 'block' }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <span>
              {imageType === 'character'}
            </span>
            <span>Press ESC or click outside to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageZoomModal
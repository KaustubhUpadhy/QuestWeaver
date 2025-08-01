import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  adventureTitle: string
  isDeleting?: boolean
}

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  adventureTitle, 
  isDeleting = false 
}: DeleteConfirmationModalProps) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isDeleting ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4">
        <div className="bg-gradient-to-b from-red-500/10 to-red-600/5 p-8 rounded-2xl border border-red-500/20 shadow-2xl backdrop-blur-xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isDeleting}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-500/20 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Delete Adventure?
            </h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete
            </p>
            <div className="p-3 bg-card/50 rounded-lg border border-border/30 mb-4">
              <p className="font-semibold text-foreground text-sm truncate">
                "{adventureTitle}"
              </p>
            </div>
            <p className="text-sm text-red-400">
              This action cannot be undone. All messages and progress will be permanently lost.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-border/50 hover:bg-card/50"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-500 hover:bg-red-600 text-white shadow-lg"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
                </div>
              ) : (
                'Delete Adventure'
              )}
            </Button>
          </div>

          {/* Warning Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground/70">
              💡 Tip: You can always create new adventures to continue your journey
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal
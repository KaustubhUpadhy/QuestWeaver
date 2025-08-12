import { useState } from 'react'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/components/AuthContext'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [step, setStep] = useState<'confirm' | 'verify'>('confirm')
  const { user, deleteUserAccount } = useAuth()

  const handleClose = () => {
    if (isDeleting) return // Prevent closing during deletion
    setStep('confirm')
    setConfirmationText('')
    onClose()
  }

  const handleConfirmDelete = () => {
    setStep('verify')
  }

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return
    }

    setIsDeleting(true)
    try {
      await deleteUserAccount()
      // User will be automatically signed out and redirected
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account. Please try again or contact support.')
      setIsDeleting(false)
    }
  }

  const isConfirmationValid = confirmationText === 'DELETE MY ACCOUNT'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-4 bg-background rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Delete Account
            </h2>
          </div>
          
          {!isDeleting && (
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'confirm' ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">
                  Are you sure you want to delete your account?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This action cannot be undone. Deleting your account will permanently remove:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                    All your adventure stories and chat history
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                    All AI-generated images and characters
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                    Your account data and preferences
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                    All associated memory and story data
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                      This action is permanent
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      We cannot recover your data once your account is deleted. Please be certain before proceeding.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmDelete}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">
                  Confirm Account Deletion
                </h3>
                <p className="text-sm text-muted-foreground">
                  To confirm deletion, please type{' '}
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                    DELETE MY ACCOUNT
                  </span>{' '}
                  in the field below:
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Type 'DELETE MY ACCOUNT' to confirm"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  className={`${
                    confirmationText && !isConfirmationValid 
                      ? 'border-red-500 focus:border-red-500' 
                      : ''
                  }`}
                  disabled={isDeleting}
                />
                {confirmationText && !isConfirmationValid && (
                  <p className="text-xs text-red-600">
                    Please type exactly: DELETE MY ACCOUNT
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Account deletion will begin immediately and cannot be cancelled once started.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('confirm')}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAccount}
                  disabled={!isConfirmationValid || isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Forever
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-muted-foreground text-center">
            Deleting account for: {user?.email}
          </p>
        </div>
      </div>
    </div>
  )
}

export default DeleteAccountModal
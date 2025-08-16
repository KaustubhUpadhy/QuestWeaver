import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sword, MessageSquare, Info, LogIn, LogOut, Menu, User, ChevronDown, Trash2, Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/AuthContext";
import AuthModal from "@/components/AuthModal";

// ProfileDropdown Component
interface ProfileDropdownProps {
  onDeleteAccount: () => void
}

const ProfileDropdown = ({ onDeleteAccount }: ProfileDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuth()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      setIsOpen(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleDeleteAccount = () => {
    setIsOpen(false)
    onDeleteAccount()
  }

  const getUserDisplayName = (email: string) => {
    return email.split('@')[0]
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <Button
        variant="ghost"
        className={`flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors ${
          isOpen ? 'bg-muted/50' : ''
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-medium text-foreground">
          {getUserDisplayName(user.email || '')}
        </span>
        
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {getUserDisplayName(user.email || '')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Logout Option */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Log out</span>
            </button>

            {/* Delete Account Option */}
            <button
              onClick={handleDeleteAccount}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// DeleteAccountModal Component
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

// Main Header Component
const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { isAuthenticated, user, signOut, isLoading } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleDeleteAccount = () => {
    setShowDeleteModal(true)
  }

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false)
  }

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      await signOut();
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    setMobileMenuOpen(false);
  };

  if (isLoading) {
    return (
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-lime-400 rounded-lg shadow-glow">
              <Sword className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              QuestWeaver
            </span>
          </div>
          <div className="animate-pulse">
            <div className="h-8 w-20 bg-muted rounded"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-lime-400 rounded-lg shadow-glow">
              <Sword className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              QuestWeaver
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/adventures"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive("/adventures") 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Adventures</span>
            </Link>
            
            <Link
              to="/about"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive("/about") 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>About</span>
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* Profile Dropdown or Auth Button */}
            {isAuthenticated && user ? (
              <div className="hidden sm:flex">
                <ProfileDropdown onDeleteAccount={handleDeleteAccount} />
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex"
                onClick={handleAuthClick}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}

            {/* Mobile menu button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="absolute top-16 left-0 right-0 bg-background border-b md:hidden">
              <nav className="flex flex-col p-4 space-y-2">
                <Link
                  to="/adventures"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/adventures") 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Adventures</span>
                </Link>
                
                <Link
                  to="/about"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/about") 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Info className="h-4 w-4" />
                  <span>About</span>
                </Link>

                {/* Mobile Profile Section */}
                <div className="border-t mt-4 pt-4">
                  {isAuthenticated && user ? (
                    <ProfileDropdown onDeleteAccount={handleDeleteAccount} />
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        handleAuthClick();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Login
                    </Button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={handleCloseDeleteModal}
      />
    </>
  );
};

export default Header;
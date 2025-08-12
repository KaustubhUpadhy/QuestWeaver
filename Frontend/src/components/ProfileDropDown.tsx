import { useState, useRef, useEffect } from 'react'
import { User, LogOut, Trash2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { useAuth } from '@/components/AuthContext'

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

  const getUserInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
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
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.user_metadata?.avatar_url} alt="Profile" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {getUserInitials(user.email || '')}
          </AvatarFallback>
        </Avatar>
        
        <span className="text-sm font-medium text-foreground hidden sm:block">
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
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.user_metadata?.avatar_url} alt="Profile" />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {getUserInitials(user.email || '')}
                </AvatarFallback>
              </Avatar>
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

export default ProfileDropdown
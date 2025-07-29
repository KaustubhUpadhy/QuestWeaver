import { useState } from 'react'
import { X, Mail, Lock, User, Github } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
  onAuthSuccess?: () => void
}

const AuthModal = ({ isOpen, onClose, initialMode = 'signup', onAuthSuccess }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Frontend logic only - simulate successful auth
    console.log(`${mode} attempt:`, formData)
    
    // Simulate auth success
    setTimeout(() => {
      onAuthSuccess?.()
      onClose()
    }, 1000)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setFormData({ fullName: '', email: '', password: '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4">
        <div className="bg-gradient-to-b from-primary/20 to-primary/10 p-8 rounded-2xl border border-primary/30 shadow-2xl backdrop-blur-xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === 'login' ? 'Return to your ongoing quests' : 'Create your account to enter new worlds'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name - Only for signup */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-foreground">
                  <User className="h-4 w-4 mr-2" />
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="bg-background/50 border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-foreground">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="bg-background/50 border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-foreground">
                <Lock className="h-4 w-4 mr-2" />
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="bg-background/50 border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full gradient-primary text-white font-semibold py-3 rounded-lg shadow-glow hover:shadow-elegant transition-all duration-300"
            >
              {mode === 'login' ? 'Login' : 'Create Account'}
            </Button>

            {/* Forgot Password - Only for login */}
            {mode === 'login' && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-border"></div>
            <span className="px-4 text-xs text-muted-foreground">
              Or {mode === 'login' ? 'login' : 'sign up'} with
            </span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-background/30 border-primary/30 text-foreground hover:bg-primary/10 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-background/30 border-primary/30 text-foreground hover:bg-primary/10 transition-colors"
            >
              <Github className="h-4 w-4 mr-2" />
              Continue with GitHub
            </Button>
          </div>

          {/* Switch Mode */}
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {mode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
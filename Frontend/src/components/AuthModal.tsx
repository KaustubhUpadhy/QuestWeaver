import { useState } from 'react'
import { X, Mail, Lock, User, Github, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/components/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
  onAuthSuccess?: () => void
}

const AuthModal = ({ isOpen, onClose, initialMode = 'signup', onAuthSuccess }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>(initialMode)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { signUp, signIn, signInWithProvider, resetPassword } = useAuth()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (mode === 'signup') {
        const { error } = await signUp(formData.email, formData.password, formData.fullName)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Check your email to confirm your account!')
          setTimeout(() => {
            onAuthSuccess?.()
            onClose()
          }, 2000)
        }
      } else if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password)
        if (error) {
          setError(error.message)
        } else {
          onAuthSuccess?.()
          onClose()
        }
      } else if (mode === 'forgot-password') {
        const { error } = await resetPassword(formData.email)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Password reset email sent! Check your inbox.')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { error } = await signInWithProvider(provider)
      if (error) {
        setError(error.message)
      }
      // Note: OAuth will redirect, so we don't need to handle success here
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear errors when user starts typing
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  const switchMode = (newMode: 'login' | 'signup' | 'forgot-password') => {
    setMode(newMode)
    setFormData({ fullName: '', email: '', password: '' })
    setError(null)
    setSuccess(null)
  }

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome Back'
      case 'signup': return 'Create Account'
      case 'forgot-password': return 'Reset Password'
    }
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Return to your ongoing quests'
      case 'signup': return 'Create your account to enter new worlds'
      case 'forgot-password': return 'Enter your email to reset your password'
    }
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
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground text-sm">
              {getSubtitle()}
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-green-500 text-sm">{success}</span>
            </div>
          )}

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
                  disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>

            {/* Password*/}
            {mode !== 'forgot-password' && (
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
                  disabled={isLoading}
                  minLength={6}
                />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full gradient-primary text-white font-semibold py-3 rounded-lg shadow-glow hover:shadow-elegant transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 
                mode === 'login' ? 'Login' : 
                mode === 'signup' ? 'Create Account' : 
                'Send Reset Email'
              }
            </Button>

            {/* Forgot Password - Only for login */}
            {mode === 'login' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('forgot-password')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </form>

          {/* OAuth Section */}
          {mode !== 'forgot-password' && (
            <>
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
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={isLoading}
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
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={isLoading}
                >
                  <Github className="h-4 w-4 mr-2" />
                  Continue with GitHub
                </Button>
              </div>
            </>
          )}

          {/* Switch Mode */}
          <div className="text-center mt-8">
            {mode === 'forgot-password' ? (
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                  disabled={isLoading}
                >
                  Back to Login
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                  disabled={isLoading}
                >
                  {mode === 'login' ? 'Sign Up' : 'Login'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
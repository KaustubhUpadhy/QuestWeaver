import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

// FIXED: Remove trailing slash to prevent double slashes
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://questweaver-819u.onrender.com'

interface AuthContextType {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithProvider: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  deleteUserAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session with better error handling
    const getInitialSession = async () => {
      try {
        console.log('🔐 AuthProvider: Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('🔐 AuthProvider: Error getting session:', error)
          // Don't throw error, just log it and continue with null session
          setSession(null)
          setUser(null)
        } else {
          console.log('🔐 AuthProvider: Initial session retrieved:', session ? 'authenticated' : 'not authenticated')
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('🔐 AuthProvider: Error in getInitialSession:', error)
        // Ensure we don't crash the app
        setSession(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes with error handling
    let subscription: any
    
    try {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          console.log('🔐 AuthProvider: Auth state changed:', event, session?.user?.email || 'no user')
          setSession(session)
          setUser(session?.user ?? null)
          setIsLoading(false)
        } catch (error) {
          console.error('🔐 AuthProvider: Error in auth state change handler:', error)
          setIsLoading(false)
        }
      })
      
      subscription = authSubscription
    } catch (error) {
      console.error('🔐 AuthProvider: Error setting up auth state listener:', error)
      setIsLoading(false)
    }

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (error) {
          console.error('🔐 AuthProvider: Error unsubscribing from auth changes:', error)
        }
      }
    }
  }, [])

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      console.log('🔐 AuthProvider: Attempting sign up for:', email)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      
      if (error) {
        console.error('🔐 AuthProvider: Sign up error:', error)
      } else {
        console.log('🔐 AuthProvider: Sign up successful')
      }
      
      return { error }
    } catch (error) {
      console.error('🔐 AuthProvider: Sign up exception:', error)
      return { error: error as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 AuthProvider: Attempting sign in for:', email)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('🔐 AuthProvider: Sign in error:', error)
      } else {
        console.log('🔐 AuthProvider: Sign in successful')
      }
      
      return { error }
    } catch (error) {
      console.error('🔐 AuthProvider: Sign in exception:', error)
      return { error: error as AuthError }
    }
  }

  const signInWithProvider = async (provider: 'google' | 'github') => {
    try {
      console.log('🔐 AuthProvider: Attempting OAuth sign in with:', provider)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/adventures`,
        },
      })
      
      if (error) {
        console.error('🔐 AuthProvider: OAuth sign in error:', error)
      } else {
        console.log('🔐 AuthProvider: OAuth sign in initiated')
      }
      
      return { error }
    } catch (error) {
      console.error('🔐 AuthProvider: OAuth sign in exception:', error)
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    try {
      console.log('🔐 AuthProvider: Attempting sign out')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('🔐 AuthProvider: Sign out error:', error)
      } else {
        console.log('🔐 AuthProvider: Sign out successful')
      }
      
      return { error }
    } catch (error) {
      console.error('🔐 AuthProvider: Sign out exception:', error)
      return { error: error as AuthError }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      console.log('🔐 AuthProvider: Attempting password reset for:', email)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        console.error('🔐 AuthProvider: Password reset error:', error)
      } else {
        console.log('🔐 AuthProvider: Password reset email sent')
      }
      
      return { error }
    } catch (error) {
      console.error('🔐 AuthProvider: Password reset exception:', error)
      return { error: error as AuthError }
    }
  }

  const deleteUserAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('No authenticated user found')
      }

      console.log('🗑️ AuthProvider: Starting account deletion process for user:', user.id)

      // Step 1: Delete all user data from backend (includes S3, ChromaDB cleanup)
      try {
        console.log('🗑️ AuthProvider: Making API call to:', `${API_BASE_URL}/api/user/delete-account`)
        
        const response = await fetch(`${API_BASE_URL}/api/user/delete-account`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('🗑️ AuthProvider: Delete API response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('🗑️ AuthProvider: Delete API error response:', errorText)
          throw new Error(`Failed to delete user data: ${response.status} ${errorText}`)
        }

        const result = await response.json()
        console.log('✅ AuthProvider: Successfully deleted user data from backend:', result)
      } catch (error) {
        console.error('❌ AuthProvider: Failed to delete backend data:', error)
        throw new Error(`Failed to delete account data: ${error}`)
      }

      // Step 2: Sign out and clear local state
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      
      console.log('✅ AuthProvider: Account deletion completed successfully')
      
      // Redirect to home page
      window.location.href = '/'
      
    } catch (error) {
      console.error('🚨 AuthProvider: Account deletion failed:', error)
      throw error
    }
  }

  const isAuthenticated = !!user

  const value = {
    user,
    session,
    isAuthenticated,
    isLoading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
    deleteUserAccount,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
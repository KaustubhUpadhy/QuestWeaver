import { createClient } from '@supabase/supabase-js'

// For Vite projects, use VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// More detailed error checking
if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL is missing from environment variables')
  console.error('Please add VITE_SUPABASE_URL to your .env file')
}

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is missing from environment variables')
  console.error('Please add VITE_SUPABASE_ANON_KEY to your .env file')
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Cannot initialize Supabase client due to missing environment variables')
  console.error('Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  console.error('Current environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? '✅ Present' : '❌ Missing',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? '✅ Present' : '❌ Missing'
  })
}

// Create a safe fallback client that won't crash the app
let supabase: any

try {
  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder-key', 
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    }
  )
  
  if (supabaseUrl && supabaseAnonKey) {
    console.log('✅ Supabase client initialized successfully')
  } else {
    console.warn('⚠️ Supabase client initialized with placeholder values due to missing environment variables')
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error)
  
  // Create a mock client that won't crash the app
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') }),
      signUp: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signInWithOAuth: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      resetPasswordForEmail: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  }
}

export { supabase }
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import ErrorBoundary from '@/components/ErrorBoundary'
import Home from '@/pages/Home'
import Adventures from '@/pages/Adventures'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'
import AuthCallback from '@/components/AuthCallback'
import { useEffect } from 'react'


window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  event.preventDefault()
})

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error)
})

function App() {
  useEffect(() => {
    const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
    const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar])
    
    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars)
      console.error('Please check your .env file and ensure all required variables are set')
    }
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="dungeoncraft-ui-theme">
        <ErrorBoundary>
          <AuthProvider>
            <ErrorBoundary>
              <BrowserRouter>
                <div className="min-h-screen bg-background text-foreground">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/adventures" element={<Adventures />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </BrowserRouter>
            </ErrorBoundary>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
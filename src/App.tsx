import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import Home from '@/pages/Home'
import Adventures from '@/pages/Adventures'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'
import AuthCallback from '@/components/AuthCallback'
import ThemeSelector from '@/components/ThemeSelector'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dungeoncraft-ui-theme">
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/adventures" element={<Adventures />} />
              <Route path="/about" element={<About />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ThemeSelector />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/components/AuthContext'
import Home from '@/pages/Home'
import Adventures from '@/pages/Adventures'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/adventures" element={<Adventures />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
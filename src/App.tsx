import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Adventures from '@/pages/Adventures'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/adventures" element={<Adventures />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
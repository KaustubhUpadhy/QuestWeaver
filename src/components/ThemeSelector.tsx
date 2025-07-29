import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

// Theme definitions
const themes = {
  royal: {
    name: 'Royal Fantasy',
    primary: '#6d28d9', // Indigo
    accent: '#fcd34d',   // Amber
    background: '#1e1b4b', // Midnight
    description: 'Majestic and enchanting'
  },
  futuristic: {
    name: 'Futuristic',
    primary: '#38bdf8', // Sky Blue
    accent: '#f472b6',  // Pink
    background: '#0f172a', // Dark Navy
    description: 'Sleek and modern'
  },
  darkArcane: {
    name: 'Dark Arcane',
    primary: '#7c3aed', // Violet
    accent: '#4ade80',  // Lime
    background: '#111827', // Dark Gray
    description: 'Mysterious and powerful'
  },
  original: {
    name: 'Original',
    primary: '#f97316', // Orange
    accent: '#fb923c',  // Light Orange
    background: '#0c0a09', // Very Dark
    description: 'Classic DungeonCraft'
  }
}

type ThemeKey = keyof typeof themes

interface ThemeSelectorProps {
  onThemeChange?: (theme: ThemeKey) => void
}

const ThemeSelector = ({ onThemeChange }: ThemeSelectorProps) => {
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('original')
  const [isOpen, setIsOpen] = useState(false)

  const applyTheme = (themeKey: ThemeKey) => {
    const theme = themes[themeKey]
    const root = document.documentElement
    
    // Convert hex to HSL for CSS custom properties
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0, s = 0, l = (max + min) / 2

      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
    }

    // Apply theme colors
    root.style.setProperty('--primary', hexToHsl(theme.primary))
    root.style.setProperty('--background', hexToHsl(theme.background))
    
    // Update gradient
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`)
    root.style.setProperty('--shadow-glow', `0 0 40px ${theme.primary}33`)
    root.style.setProperty('--shadow-elegant', `0 10px 30px -10px ${theme.primary}22`)

    setSelectedTheme(themeKey)
    onThemeChange?.(themeKey)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Theme Selector Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full w-14 h-14 shadow-lg gradient-primary"
        size="icon"
      >
        <Palette className="h-6 w-6" />
      </Button>

      {/* Theme Options Panel */}
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 shadow-2xl border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Choose Your Theme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(themes).map(([key, theme]) => (
              <div
                key={key}
                onClick={() => applyTheme(key as ThemeKey)}
                className={`group cursor-pointer p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                  selectedTheme === key 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{theme.name}</h3>
                  {selectedTheme === key && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">
                  {theme.description}
                </p>

                {/* Color Preview */}
                <div className="flex gap-2 mb-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: theme.primary }}
                    title="Primary"
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: theme.accent }}
                    title="Accent"
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: theme.background }}
                    title="Background"
                  />
                </div>

                {/* Gradient Preview */}
                <div 
                  className="w-full h-2 rounded-full"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` 
                  }}
                />
              </div>
            ))}

            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ThemeSelector
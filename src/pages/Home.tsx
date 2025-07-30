import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Users, Star, BookOpen, Sword, Zap, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/components/AuthContext'
import AuthModal from '@/components/AuthModal'
import Header from '@/components/Header'

const Home = () => {
  const [activeFeature, setActiveFeature] = useState(0)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const { isAuthenticated } = useAuth()
  
  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Storytelling',
      description: 'Experience dynamic narratives that adapt to every choice you make'
    },
    {
      icon: BookOpen,
      title: 'Infinite Adventures', 
      description: 'Explore unlimited worlds from fantasy realms to sci-fi galaxies'
    },
    {
      icon: Users,
      title: 'Community Driven',
      description: 'Share your epic tales with fellow adventurers worldwide'
    }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Navigate to adventures if already authenticated
      window.location.href = '/adventures'
    } else {
      // Open signup modal if not authenticated
      setAuthModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 gradient-secondary" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        
        <div className="relative container mx-auto px-4 pt-20 pb-32">
          <div className="flex justify-center">
            {/* Centered Content */}
            <div className="max-w-4xl text-center space-y-8 animate-fade-in">
              {/* Main Headline */}
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-bold leading-tight animate-fade-in">
                  <span className="block animate-slide-up">Craft Your Adventure</span>
                  <span className="block text-primary animate-glow animate-slide-up animate-delay-300">
                    As You Live It
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in animate-delay-500">
                  AI-powered storytelling where your choices shape the narrative. 
                  Create unlimited stories that respond to your every decision.
                </p>
              </div>

              {/* CTA Button */}
              <div className="flex justify-center animate-fade-in animate-delay-700">
                {isAuthenticated ? (
                  <Link to="/adventures">
                    <Button size="lg" className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300 group animate-bounce-gentle">
                      <Sparkles className="h-5 w-5 mr-2 group-hover:animate-spin" />
                      Start My Adventure Now
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="lg" 
                    className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300 group animate-bounce-gentle"
                    onClick={handleGetStarted}
                  >
                    <Sparkles className="h-5 w-5 mr-2 group-hover:animate-spin" />
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                )}
              </div>

              {/* Additional Info */}
              <p className="text-sm text-muted-foreground animate-fade-in animate-delay-1000">
                100% Free to start • Create unlimited stories • No credit card needed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Adventurers Choose DungeonCraft AI</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the next generation of interactive storytelling
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`group hover:shadow-elegant transition-all duration-300 cursor-pointer ${
                  activeFeature === index ? 'border-primary shadow-glow' : ''
                }`}
                onClick={() => setActiveFeature(index)}
              >
                <CardHeader>
                  <feature.icon className={`h-10 w-10 mb-2 transition-colors ${
                    activeFeature === index ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Ready to Begin Your Epic Journey?</h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of adventurers crafting their stories with AI-powered narratives
            </p>
            <Button 
              size="lg" 
              className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300"
              onClick={handleGetStarted}
            >
              <Sword className="h-5 w-5 mr-2" />
              {isAuthenticated ? 'Start Your Adventure' : 'Get Started'}
            </Button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="signup"
      />
    </div>
  )
}

export default Home
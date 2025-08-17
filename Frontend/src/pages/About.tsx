import { Zap, BookOpen, Users, Heart, Target, Lightbulb, Image as ImageIcon, Brain, Sparkles, Shield, Palette, Infinity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import Header from '@/components/Header'

const About = () => {
  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Narratives',
      description: 'Our advanced AI creates dynamic stories that adapt to your every choice, ensuring no two adventures are ever the same.'
    },
    {
      icon: ImageIcon,
      title: 'AI-Generated Visuals',
      description: 'Immerse yourself with stunning AI-generated world scenes and character portraits that bring your adventures to life.'
    },
    {
      icon: Brain,
      title: 'RAG Memory System',
      description: 'Advanced memory capabilities that remember every detail of your journey, creating consistent and evolving storylines.'
    },
    {
      icon: BookOpen,
      title: 'Infinite Possibilities',
      description: 'From fantasy realms to sci-fi galaxies, explore unlimited worlds limited only by your imagination.'
    },
    {
      icon: Sparkles,
      title: 'Dynamic Characters',
      description: 'Create and interact with rich, evolving characters that remember your relationships and past interactions.'
    }
  ]

  const values = [
    {
      icon: Heart,
      title: 'Creativity First',
      description: 'We believe everyone has a story to tell. Our platform empowers your creativity without limits or restrictions.'
    },
    {
      icon: Target,
      title: 'Quality Experience',
      description: 'Every interaction is crafted to provide meaningful, engaging storytelling experiences that evolve with you.'
    },
    {
      icon: Lightbulb,
      title: 'Innovation',
      description: 'We continuously push the boundaries of what\'s possible in interactive storytelling and AI-assisted creativity.'
    },
    {
      icon: Shield,
      title: 'User Privacy',
      description: 'Your stories and adventures are yours. We prioritize privacy and give you full control over your creative content.'
    },
    {
      icon: Palette,
      title: 'Artistic Vision',
      description: 'Combining cutting-edge AI with beautiful design to create visually stunning and emotionally engaging experiences.'
    },
    {
      icon: Infinity,
      title: 'Limitless Growth',
      description: 'Our platform evolves with you, offering new features and capabilities as your storytelling ambitions grow.'
    }
  ]

  const technicalFeatures = [
    {
      title: 'Advanced AI Storytelling',
      description: 'Powered by GPT-4, our AI creates contextually aware narratives that respond intelligently to your choices and remember your entire journey.'
    },
    {
      title: 'Visual World Building',
      description: 'Stable-Diffusion-XL integration generates unique world scenes and character portraits, stored securely in cloud infrastructure for instant access.'
    },
    {
      title: 'Semantic Memory',
      description: 'ChromaDB-powered memory system ensures story continuity by semantically understanding and recalling important plot points and character development.'
    },
    {
      title: 'Real-time Collaboration',
      description: 'Built on modern web technologies for seamless, responsive experiences across all devices with real-time story generation.'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold">
              About <span className="text-primary">QuestWeaver</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              We're revolutionizing storytelling by combining the limitless creativity of human imagination 
              with the power of artificial intelligence to create truly personalized, visually stunning adventures.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <span className="px-3 py-1 bg-primary/10 rounded-full">🤖 AI-Powered</span>
              <span className="px-3 py-1 bg-primary/10 rounded-full">🎨 Visual Storytelling</span>
              <span className="px-3 py-1 bg-primary/10 rounded-full">🧠 Advanced Memory</span>
              <span className="px-3 py-1 bg-primary/10 rounded-full">🌍 Infinite Worlds</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold">Empowering Every Storyteller</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Traditional storytelling often requires extensive writing skills, artistic abilities, or game mastering experience. 
                  QuestWeaver breaks down these barriers, allowing anyone to create and experience rich, 
                  interactive narratives with stunning visuals, regardless of their background or technical expertise.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our AI acts as your personal dungeon master, artist, and creative partner, adapting to your 
                  choices and weaving compelling stories that respond to your unique play style and preferences while 
                  generating beautiful imagery to bring your world to life.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 p-8 rounded-2xl">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">The QuestWeaver Difference</h4>
                    <p className="text-sm text-muted-foreground">
                      Unlike traditional text-based adventures, QuestWeaver creates a fully immersive experience 
                      with AI-generated visuals, intelligent memory systems, and narratives that truly evolve with your choices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Platform Features</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience cutting-edge AI technology, powered by GPT-4 designed to enhance your creative storytelling journey
            </p>
          </div>

          <div className="space-y-8">
            {/* First row - 3 cards */}
            <div className="grid md:grid-cols-3 gap-8">
              {features.slice(0, 3).map((feature, index) => (
                <Card key={index} className="group hover:shadow-elegant transition-all duration-300">
                  <CardHeader>
                    <feature.icon className="h-12 w-12 mb-4 text-primary group-hover:scale-110 transition-transform" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            
            {/* Second row - 2 cards centered */}
            <div className="flex justify-center">
              <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
                {features.slice(3, 5).map((feature, index) => (
                  <Card key={index + 3} className="group hover:shadow-elegant transition-all duration-300">
                    <CardHeader>
                      <feature.icon className="h-12 w-12 mb-4 text-primary group-hover:scale-110 transition-transform" />
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Technical Innovation</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built with AI technologies to deliver unparalleled storytelling experiences
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {technicalFeatures.map((feature, index) => (
              <div key={index} className="bg-card/50 p-6 rounded-xl border border-border/50">
                <h4 className="font-semibold text-lg mb-3 text-primary">{feature.title}</h4>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 via-purple-500/5 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Ready to Weave Your Quest?</h2>
            <p className="text-xl text-muted-foreground">
              Join the future of interactive storytelling. Create your first adventure today and discover 
              what's possible when AI meets imagination.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/adventures">
                <Button size="lg" className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Your Adventure
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
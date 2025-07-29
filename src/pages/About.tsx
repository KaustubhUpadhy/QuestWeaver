import { Zap, BookOpen, Users, Heart, Target, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Header from '@/components/Header'

const About = () => {
  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Narratives',
      description: 'Our advanced AI creates dynamic stories that adapt to your every choice, ensuring no two adventures are ever the same.'
    },
    {
      icon: BookOpen,
      title: 'Infinite Possibilities',
      description: 'From fantasy realms to sci-fi galaxies, explore unlimited worlds limited only by your imagination.'
    },
    {
      icon: Users,
      title: 'Community Driven',
      description: 'Share your adventures, discover stories from other players, and build a community of fellow storytellers.'
    }
  ]

  const values = [
    {
      icon: Heart,
      title: 'Creativity First',
      description: 'We believe everyone has a story to tell. Our platform empowers your creativity without limits.'
    },
    {
      icon: Target,
      title: 'Quality Experience',
      description: 'Every interaction is crafted to provide meaningful, engaging storytelling experiences.'
    },
    {
      icon: Lightbulb,
      title: 'Innovation',
      description: 'We continuously push the boundaries of what\'s possible in interactive storytelling.'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">
              About <span className="text-primary">DungeonCraft AI</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              We're revolutionizing storytelling by combining the limitless creativity of human imagination 
              with the power of artificial intelligence to create truly personalized adventures.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-xl text-muted-foreground">
                To democratize storytelling and make every person the hero of their own epic tale
              </p>
            </div>

            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h3 className="text-2xl font-semibold">Empowering Every Storyteller</h3>
              <p className="text-muted-foreground leading-relaxed">
                Traditional storytelling often requires extensive writing skills or game mastering experience. 
                DungeonCraft AI breaks down these barriers, allowing anyone to create and experience rich, 
                interactive narratives regardless of their background or technical expertise.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our AI acts as your personal dungeon master, guide, and creative partner, adapting to your 
                choices and weaving compelling stories that respond to your unique play style and preferences.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
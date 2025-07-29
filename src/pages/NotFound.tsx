import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Header from '@/components/Header'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-8 max-w-md">
          <div className="space-y-4">
            <h1 className="text-8xl font-bold text-primary">404</h1>
            <h2 className="text-2xl font-semibold">Adventure Not Found</h2>
            <p className="text-muted-foreground">
              It seems this path leads to an uncharted realm. Let's get you back to familiar territory.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <Button className="gradient-primary">
                <Home className="h-4 w-4 mr-2" />
                Return Home
              </Button>
            </Link>
            <Link to="/adventures">
              <Button variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Browse Adventures
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFound
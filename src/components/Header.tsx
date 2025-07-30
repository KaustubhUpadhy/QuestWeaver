import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sword, MessageSquare, Info, LogIn, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/AuthContext";
import AuthModal from "@/components/AuthModal";

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout();
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-lime-400 rounded-lg shadow-glow">
              <Sword className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              DungeonCraft AI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/adventures"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive("/adventures") 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Adventures</span>
            </Link>
            
            <Link
              to="/about"
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive("/about") 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>About</span>
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* Login/Logout button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden sm:flex"
              onClick={handleAuthClick}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {isAuthenticated ? 'Logout' : 'Login'}
            </Button>

            {/* Mobile menu button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="absolute top-16 left-0 right-0 bg-background border-b md:hidden">
              <nav className="flex flex-col p-4 space-y-2">
                <Link
                  to="/adventures"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/adventures") 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Adventures</span>
                </Link>
                
                <Link
                  to="/about"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive("/about") 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Info className="h-4 w-4" />
                  <span>About</span>
                </Link>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => {
                    handleAuthClick();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {isAuthenticated ? 'Logout' : 'Login'}
                </Button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        onAuthSuccess={() => {
          // Simulate successful authentication
          const mockUser = {
            id: '1',
            name: 'Adventure Seeker',
            email: 'user@example.com'
          };
          // This would typically be handled by the AuthModal component
          console.log('Auth successful');
        }}
      />
    </>
  );
};

export default Header;
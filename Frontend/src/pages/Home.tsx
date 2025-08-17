import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Play,
  Users,
  Star,
  BookOpen,
  Sword,
  Zap,
  ArrowRight,
  Sparkles,
  User,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { useAuth } from "@/components/AuthContext";
import { AdventureService } from "@/services/AdventureService";
import AuthModal from "@/components/AuthModal";
import Header from "@/components/Header";

interface Adventure {
  sessionId: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
  characterImageUrl?: string;
  worldImageUrl?: string;
  worldImageStatus?: "pending" | "ready" | "failed";
  characterImageStatus?: "pending" | "ready" | "failed";
  isImagesLoading?: boolean;
  imageLoadError?: boolean;
  genre?: string[];
}

const Home = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [isLoadingAdventures, setIsLoadingAdventures] = useState(false);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState<
    boolean | undefined
  >(undefined);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();



  const features = [
    {
      icon: Zap,
      title: "AI-Powered Storytelling",
      description:
        "Experience dynamic narratives that adapt to every choice you make",
    },
    {
      icon: ImageIcon,
      title: "AI-Generated Worlds",
      description:
        "Immerse yourself with stunning AI-generated world and character images",
    },
    {
      icon: BookOpen,
      title: "Infinite Adventures",
      description:
        "Explore unlimited worlds from fantasy realms to sci-fi galaxies",
    },
  ];


  // Helper function to extract genre tags from story content
  const extractGenreTags = (title: string, content: string): string[] => {
    const genres: string[] = [];
    const text = (title + " " + content).toLowerCase();

    // Common genre keywords
    const genreMap = {
      Adventure: ["adventure", "quest", "journey", "explore"],
      Fantasy: ["magic", "wizard", "dragon", "fantasy", "realm", "kingdom"],
      Mystery: ["mystery", "detective", "clue", "solve", "investigation"],
      Horror: ["horror", "ghost", "haunted", "dark", "scary", "cursed"],
      Survival: ["survival", "survive", "wilderness", "stranded"],
      Comedy: ["comedy", "funny", "humor", "laugh"],
      Action: ["action", "fight", "battle", "combat"],
      Suspense: ["suspense", "thriller", "tension"],
      Realistic: ["realistic", "modern", "contemporary"],
      "Sci-Fi": ["space", "alien", "future", "technology", "robot"],
    };

    for (const [genre, keywords] of Object.entries(genreMap)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        genres.push(genre);
      }
    }

    return genres.slice(0, 3); // Limit to 3 tags
  };

  // Helper function to extract preview text
  const extractPreview = (content: string): string => {
    const lines = content.split("\n").filter((line) => line.trim());
    const contentWithoutTitle = lines.slice(1).join(" ");
    return contentWithoutTitle.length > 120
      ? contentWithoutTitle.substring(0, 120) + "..."
      : contentWithoutTitle;
  };

  // Helper function to format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMs = now.getTime() - messageDate.getTime();

    const minutes = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
      return "Just now";
    } else if (minutes < 60) {
      return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (days < 7) {
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    } else {
      return messageDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          messageDate.getFullYear() !== now.getFullYear()
            ? "numeric"
            : undefined,
      });
    }
  };


  const checkImageSystemHealth = async () => {
    try {
      console.log("Home: Checking image system health...");

      setImageGenerationEnabled(true);
      console.log(
        "Home: Image generation enabled (health check bypassed)"
      );
    } catch (error) {
      console.error("ome: Image system health check error:", error);
      setImageGenerationEnabled(true);
      console.log(
        "Home: Image generation enabled (despite health check error)"
      );
    }
  };

  // Load image URLs for an adventure with retry and persistence
  const loadAdventureImages = async (
    adventure: Adventure
  ): Promise<Adventure> => {
    if (!imageGenerationEnabled) {
      console.log(
        `Home: Image generation disabled, skipping ${adventure.sessionId}`
      );
      return adventure;
    }

    try {
      console.log(
        `Home: Loading images for adventure ${adventure.sessionId}`
      );

      
      const result = await AdventureService.loadAdventureImagesWithRetry(
        adventure,
        3
      ); // Extra retry for reliability

      console.log(`Home: Images loaded for ${adventure.sessionId}:`, {
        world: !!result.worldImageUrl,
        character: !!result.characterImageUrl,
        loading: result.isImagesLoading,
        error: result.imageLoadError,
      });

      return result;
    } catch (error) {
      console.error(
        `Home: Failed to load images for ${adventure.sessionId}:`,
        error
      );
      return {
        ...adventure,
        imageLoadError: true,
        isImagesLoading: false,
      };
    }
  };

  // Load user's adventures with persistent images
  const loadAdventures = async () => {
    if (!isAuthenticated) {
      console.log("Home: Not authenticated, skipping adventure loading");
      return;
    }

    setIsLoadingAdventures(true);
    try {
      console.log("Home: Loading user adventures for home page...");
      const response = await AdventureService.getUserSessions();

      // Get the 6 most recent adventures
      const recentSessions = response.sessions.slice(0, 6);

      // Create base adventures first
      const baseAdventures: Adventure[] = recentSessions.map((session) => ({
        sessionId: session.session_id,
        title: session.title,
        lastMessage:
          session.last_message_preview || extractPreview(session.title),
        timestamp: session.last_updated || session.created_at,
        messageCount: session.message_count,
        worldImageStatus: session.world_image_status || "pending",
        characterImageStatus: session.character_image_status || "pending",
        isImagesLoading:
          session.world_image_status === "pending" ||
          session.character_image_status === "pending",
        genre: extractGenreTags(
          session.title,
          session.last_message_preview || ""
        ),
        imageLoadError: false,
      }));

      console.log(
        `Home: Loaded ${baseAdventures.length} base adventures from database`
      );

      // Load images if system is enabled
      if (imageGenerationEnabled) {
        console.log("Home: Loading images for all adventures...");

        try {
          // Process adventures in smaller batches for reliability
          const batchSize = 2; 
          const adventuresWithImages: Adventure[] = [];

          for (let i = 0; i < baseAdventures.length; i += batchSize) {
            const batch = baseAdventures.slice(i, i + batchSize);
            console.log(
              `Home: Processing batch ${
                Math.floor(i / batchSize) + 1
              }/${Math.ceil(baseAdventures.length / batchSize)}`
            );

            try {
              const batchResults = await Promise.allSettled(
                batch.map(async (adventure) => {
                  try {
                    return await loadAdventureImages(adventure);
                  } catch (error) {
                    console.error(
                      `Failed to load images for adventure ${adventure.sessionId}:`,
                      error
                    );
                    return {
                      ...adventure,
                      imageLoadError: true,
                      isImagesLoading: false,
                    };
                  }
                })
              );

              // Process batch results
              batchResults.forEach((result, index) => {
                if (result.status === "fulfilled") {
                  adventuresWithImages.push(result.value);
                } else {
                  console.error(
                    "Failed to process adventure in batch:",
                    result.reason
                  );
                  adventuresWithImages.push({
                    ...batch[index],
                    imageLoadError: true,
                    isImagesLoading: false,
                  });
                }
              });

              // Update state progressively for better UX
              setAdventures([...adventuresWithImages]);

              // Small delay between batches to avoid overwhelming the API
              if (i + batchSize < baseAdventures.length) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            } catch (batchError) {
              console.error(
                `Failed to process batch starting at index ${i}:`,
                batchError
              );
              // Add adventures without images if batch fails
              adventuresWithImages.push(
                ...batch.map((adv) => ({
                  ...adv,
                  imageLoadError: true,
                  isImagesLoading: false,
                }))
              );
            }
          }

          console.log(
            `Home: Loaded images for ${adventuresWithImages.length} adventures`
          );
          setAdventures(adventuresWithImages);
        } catch (error) {
          console.error("Home: Failed to process adventure images:", error);
          // Fallback to adventures without images rather than failing completely
          setAdventures(
            baseAdventures.map((adv) => ({
              ...adv,
              imageLoadError: true,
              isImagesLoading: false,
            }))
          );
        }
      } else {
        // No image generation, just set base adventures
        console.log(
          "Home: Image generation disabled, setting adventures without images"
        );
        setAdventures(baseAdventures);
      }
    } catch (error) {
      console.error("Home: Failed to load adventures:", error);
      // Don't show error to user, just log it
    } finally {
      setIsLoadingAdventures(false);
    }
  };

  // Continue adventure handler
  const handleContinueAdventure = (adventure: Adventure) => {
    // Navigate to adventures page with the adventure ID in the URL
    navigate(`/adventures?select=${adventure.sessionId}`);
  };

  // Periodically update image status for pending adventures
  useEffect(() => {
    if (!imageGenerationEnabled || !isAuthenticated || adventures.length === 0)
      return;

    const updatePendingImages = async () => {
      const pendingAdventures = adventures.filter(
        (adv) => adv.isImagesLoading && !adv.imageLoadError
      );

      if (pendingAdventures.length === 0) return;

      try {
        console.log(
          `Home: Updating ${pendingAdventures.length} pending adventures`
        );

        const updatedAdventures = await Promise.allSettled(
          adventures.map(async (adventure) => {
            if (adventure.isImagesLoading && !adventure.imageLoadError) {
              try {
                return await loadAdventureImages(adventure);
              } catch (error) {
                console.error(
                  `Failed to update images for adventure ${adventure.sessionId}:`,
                  error
                );
                return {
                  ...adventure,
                  imageLoadError: true,
                  isImagesLoading: false,
                };
              }
            }
            return adventure;
          })
        );

        // Process results
        const processedAdventures = updatedAdventures.map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            console.error("Failed to update adventure:", result.reason);
            return {
              ...adventures[index],
              imageLoadError: true,
              isImagesLoading: false,
            };
          }
        });

        // Only update state if there are actual changes
        const hasChanges = processedAdventures.some((updated, index) => {
          const original = adventures[index];
          return (
            updated.worldImageUrl !== original.worldImageUrl ||
            updated.characterImageUrl !== original.characterImageUrl ||
            updated.isImagesLoading !== original.isImagesLoading ||
            updated.imageLoadError !== original.imageLoadError
          );
        });

        if (hasChanges) {
          console.log("Home: Updated pending images with changes");
          setAdventures(processedAdventures);
        }
      } catch (error) {
        console.error("Home: Error updating pending images:", error);
      }
    };

    // Update pending images every 10 seconds (more frequent for better UX)
    const interval = setInterval(updatePendingImages, 10000);
    return () => clearInterval(interval);
  }, [adventures, imageGenerationEnabled, isAuthenticated]);

  //Proper initialization order
  useEffect(() => {
    if (isAuthenticated) {
      console.log("Home: User authenticated, initializing image system");
      checkImageSystemHealth();
    }
  }, [isAuthenticated]);

  // Load adventures after image system is confirmed ready
  useEffect(() => {
    if (isAuthenticated && imageGenerationEnabled !== undefined) {
      console.log("Home: Image system ready, loading adventures");
      loadAdventures();
    }
  }, [isAuthenticated, imageGenerationEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Navigate to adventures if already authenticated
      window.location.href = "/adventures";
    } else {
      // Open signup modal if not authenticated
      setAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    // The auth context will handle the user state automatically
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-pulse text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
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
            <div className="max-w-6xl text-center space-y-10 animate-fade-in">
              {/* Main Headline*/}
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold leading-tight animate-fade-in">
                  <span className="block animate-slide-up">
                    Craft Your Adventure
                  </span>
                  <span className="block text-primary animate-glow animate-slide-up animate-delay-300">
                    As You Live It
                  </span>
                </h1>
                <p className="text-2xl md:text-3xl lg:text-4xl text-muted-foreground max-w-4xl mx-auto animate-fade-in animate-delay-500 leading-relaxed">
                  AI-powered storytelling where your choices shape the
                  narrative. Create unlimited stories that respond to your every
                  decision.
                  {imageGenerationEnabled && (
                    <span className="block mt-4 text-xl text-primary/80"></span>
                  )}
                </p>
              </div>

              {/* CTA Button - LARGER BUTTON */}
              <div className="flex justify-center animate-fade-in animate-delay-700">
                {isAuthenticated ? (
                  <Link to="/adventures">
                    <Button
                      size="lg"
                      className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300 group animate-bounce-gentle text-xl px-12 py-6"
                    >
                      <Sparkles className="h-6 w-6 mr-3 group-hover:animate-spin" />
                      Start My Adventure Now
                      <ArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300 group animate-bounce-gentle text-xl px-12 py-6"
                    onClick={handleGetStarted}
                  >
                    <Sparkles className="h-6 w-6 mr-3 group-hover:animate-spin" />
                    Get Started
                    <ArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                )}
              </div>

              {/* Additional Info */}
              <p className="text-lg md:text-xl text-muted-foreground animate-fade-in animate-delay-1000">
                100% Free to start • Create unlimited stories
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Cards Section - Only show for authenticated users with adventures */}
      {isAuthenticated && (adventures.length > 0 || isLoadingAdventures) && (
        <section className="py-20 border-t bg-card/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Continue Your Adventures
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Pick up where you left off in your epic journeys
                {imageGenerationEnabled && (
                  <span className="block mt-2 text-sm text-primary/80"></span>
                )}
              </p>
            </div>

            {isLoadingAdventures ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse overflow-hidden">
                    <div className="h-48 bg-muted"></div>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-6 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-4 bg-muted rounded w-5/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {adventures.map((adventure) => (
                  <Card
                    key={adventure.sessionId}
                    className="group hover:shadow-elegant transition-all duration-300 cursor-pointer overflow-hidden border-border/50 hover:border-primary/50 relative"
                    onClick={() => handleContinueAdventure(adventure)}
                  >
                    {/* World Image Background */}
                    <div className="relative h-48 overflow-hidden">
                      {adventure.worldImageUrl ? (
                        <img
                          src={adventure.worldImageUrl}
                          alt={adventure.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            console.error(
                              `Home: World image failed to load for ${adventure.sessionId}`
                            );
                            // Don't hide the image, let it show broken image icon
                          }}
                          onLoad={() => {
                            console.log(
                              `Home: World image loaded successfully for ${adventure.sessionId}`
                            );
                          }}
                        />
                      ) : adventure.isImagesLoading ? (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-purple-500/20 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <Loader2 className="h-8 w-8 text-primary/70 animate-spin mx-auto" />
                            <p className="text-xs text-primary/70">
                              Generating world...
                            </p>
                          </div>
                        </div>
                      ) : adventure.imageLoadError ? (
                        <div className="w-full h-full bg-gradient-to-br from-red-500/20 via-red-400/20 to-red-300/20 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <ImageIcon className="h-8 w-8 text-red-500/70 mx-auto" />
                            <p className="text-xs text-red-500/70">
                              Image failed
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-purple-500/20 flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-primary/70" />
                        </div>
                      )}

                      {/* Genre Tags */}
                      {adventure.genre && adventure.genre.length > 0 && (
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                          {adventure.genre.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-full backdrop-blur-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Character Avatar */}
                      <div className="absolute top-3 right-3">
                        <Avatar className="h-12 w-12 ring-2 ring-white/50 relative">
                          {adventure.characterImageUrl ? (
                            <AvatarImage
                              src={adventure.characterImageUrl}
                              alt="Character"
                              onError={(e) => {
                                console.error(
                                  `Home: Character image failed to load for ${adventure.sessionId}`
                                );
                              }}
                              onLoad={() => {
                                console.log(
                                  `Home: Character image loaded successfully for ${adventure.sessionId}`
                                );
                              }}
                            />
                          ) : adventure.isImagesLoading ? (
                            <AvatarFallback className="bg-white/90 text-primary">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </AvatarFallback>
                          ) : adventure.imageLoadError ? (
                            <AvatarFallback className="bg-red-100 text-red-500">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          ) : (
                            <AvatarFallback className="bg-white/90 text-primary">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          )}
                        </Avatar>

                        {/* Image generation status indicator */}
                        {imageGenerationEnabled && (
                          <div className="absolute -bottom-1 -right-1">
                            {adventure.isImagesLoading ? (
                              <div
                                className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-white animate-pulse"
                                title="Generating images..."
                              />
                            ) : adventure.imageLoadError ? (
                              <div
                                className="w-4 h-4 bg-red-500 rounded-full border-2 border-white"
                                title="Image loading failed"
                              />
                            ) : adventure.worldImageUrl ||
                              adventure.characterImageUrl ? (
                              <div
                                className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                                title="Images loaded"
                              />
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Image generation progress indicator */}
                      {adventure.isImagesLoading && (
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="bg-black/70 rounded-full px-3 py-1 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-white text-xs">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>AI generating visuals...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Image error indicator */}
                      {adventure.imageLoadError && (
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="bg-red-500/70 rounded-full px-3 py-1 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-white text-xs">
                              <ImageIcon className="h-3 w-3" />
                              <span>Images failed to load</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                            {adventure.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                            {adventure.lastMessage}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span>{adventure.messageCount} messages</span>
                            <span>
                              {formatRelativeTime(adventure.timestamp)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all duration-200 group-hover:shadow-glow"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Continue
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* View All Adventures Link */}
            {adventures.length > 0 && (
              <div className="text-center mt-8">
                <Link to="/adventures">
                  <Button variant="outline" size="lg" className="group">
                    View All Adventures
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Why Choose QuestWeaver
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience interactive storytelling with
              AI-generated visuals
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`group hover:shadow-elegant transition-all duration-300 cursor-pointer ${
                  activeFeature === index ? "border-primary shadow-glow" : ""
                }`}
                onClick={() => setActiveFeature(index)}
              >
                <CardHeader>
                  <feature.icon
                    className={`h-10 w-10 mb-2 transition-colors ${
                      activeFeature === index
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
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
            <h2 className="text-3xl font-bold">
              Ready to Begin Your Epic Journey?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join to craft your stories the way you want, with
              AI-powered narratives and stunning visuals
            </p>
            <Button
              size="lg"
              className="gradient-primary shadow-glow hover:shadow-elegant transition-all duration-300"
              onClick={handleGetStarted}
            >
              <Sword className="h-5 w-5 mr-2" />
              {isAuthenticated ? "Start Your Adventure" : "Get Started"}
            </Button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="signup"
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Home;

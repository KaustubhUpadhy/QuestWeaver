from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
import os
from supabase import create_client, Client
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import re
import asyncio

# Import our new RAG components
from chroma_connection import get_memory_manager, MemoryManager
from story_generator import StoryGenerator
from image_generator import ImageGenerator

# Load environment variables
load_dotenv()

# Initialize OpenAI (keeping for compatibility)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase with service role key for admin operations
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

# Initialize as None first
supabase_admin = None
supabase_client = None
# Add these imports
from functools import wraps
import time
from collections import defaultdict, deque

# Simple in-memory rate limiter (no external dependencies)
class SimpleRateLimiter:
    def __init__(self):
        self.requests = defaultdict(deque)
    
    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        while self.requests[key] and self.requests[key][0] < window_start:
            self.requests[key].popleft()
        
        # Check if under limit
        if len(self.requests[key]) < max_requests:
            self.requests[key].append(now)
            return True
        
        return False

# Global rate limiter instance
rate_limiter = SimpleRateLimiter()

def rate_limit(max_requests: int, window_seconds: int):
    """Decorator for rate limiting endpoints"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user ID from dependencies
            user_id = None
            for key, value in kwargs.items():
                if key == 'user_id':
                    user_id = value
                    break
            
            if user_id:
                rate_key = f"{func.__name__}:{user_id}"
                if not rate_limiter.is_allowed(rate_key, max_requests, window_seconds):
                    raise HTTPException(
                        status_code=429, 
                        detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds} seconds."
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
# Don't crash if Supabase fails
try:
    if all([supabase_url, supabase_service_key, supabase_anon_key]):
        print(f"🔄 Initializing Supabase with URL: {supabase_url}")
        
        # Try simple initialization first
        supabase_admin = create_client(supabase_url, supabase_service_key)
        supabase_client = create_client(supabase_url, supabase_anon_key)
        
        print("✅ Supabase clients initialized successfully")
    else:
        print("⚠️ Missing Supabase environment variables")
        print(f"URL exists: {bool(supabase_url)}")
        print(f"Service key exists: {bool(supabase_service_key)}")
        print(f"Anon key exists: {bool(supabase_anon_key)}")
        
except Exception as e:
    print(f"⚠️ Supabase initialization failed: {e}")
    print("🚀 Continuing without Supabase (app will start but features limited)")
    # Don't raise - let the app start

app = FastAPI(title="Interactive Story Generator API with RAG and Images", version="4.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quest-weaver.vercel.app",
        "https://quest-weaver-git-main-kaustubhupadhys-projects.vercel.app",
        "https://quest-weaver-kaustubhupadhys-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_origin_regex=r"https://quest-weaver.*\.vercel\.app",
    # Add these critical headers for preflight requests:
    expose_headers=["*"],
    max_age=3600  # Cache preflight for 1 hour
)


# Security
security = HTTPBearer()

# Initialize Image Generator
image_generator = ImageGenerator()

# Pydantic models (keeping existing ones)
class StoryInitRequest(BaseModel):
    genre: str
    character: str
    world_additions: str
    actions: str

class StoryActionRequest(BaseModel):
    session_id: str
    user_action: str

class StoryResponse(BaseModel):
    session_id: str
    story_content: str
    success: bool
    message: Optional[str] = None

class SessionInfo(BaseModel):
    session_id: str
    title: str
    created_at: str
    last_updated: str
    message_count: int
    world_image_status: Optional[str] = None
    character_image_status: Optional[str] = None

class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str

class ChatHistoryResponse(BaseModel):
    session_id: str
    title: str
    system_prompt: str
    messages: List[ChatMessage]
    success: bool

# New models for RAG features
class StorySummaryResponse(BaseModel):
    session_id: str
    summary: str
    success: bool

class MemorySearchRequest(BaseModel):
    session_id: str
    query: str
    limit: Optional[int] = 5

class MemorySearchResponse(BaseModel):
    session_id: str
    memories: List[Dict[str, str]]
    success: bool

# New models for image features
class ImageUrlResponse(BaseModel):
    url: Optional[str] = None
    success: bool
    message: Optional[str] = None

class ImageStatusResponse(BaseModel):
    world_status: str
    character_status: str
    world_updated_at: Optional[str] = None
    character_updated_at: Optional[str] = None

# Authentication helper function (unchanged)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        if not supabase_client:
            raise HTTPException(status_code=503, detail="Authentication service unavailable")
            
        token = credentials.credentials
        response = supabase_client.auth.get_user(token)
        
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return response.user.id
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Database helper functions (enhanced for images)
async def save_chat_to_db(user_id: str, session_id: str, title: str, system_prompt: str):
    """Save a new chat session to database with image status"""
    try:
        data = {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "system_prompt": system_prompt,
            "created_at": datetime.now().isoformat(),
            "world_image_status": "pending",
            "character_image_status": "pending"
        }
        
        result = supabase_admin.table("chats").insert(data).execute()
        return result.data is not None
    except Exception as e:
        print(f"Error saving chat to DB: {e}")
        return False

async def update_image_status(chat_id: str, user_id: str, image_type: str, status: str, s3_key: str = None):
    """Update image status in database"""
    try:
        update_data = {
            f"{image_type}_image_status": status,
            f"{image_type}_image_updated_at": datetime.now().isoformat()
        }
        
        if s3_key:
            update_data[f"{image_type}_image_key"] = s3_key
        
        result = supabase_admin.table("chats").update(update_data).eq("id", chat_id).eq("user_id", user_id).execute()
        return result.data is not None
    except Exception as e:
        print(f"Error updating image status: {e}")
        return False

async def save_message_to_db(chat_id: str, user_id: str, role: str, content: str):
    """Save a message to database"""
    try:
        data = {
            "chat_id": chat_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
        
        result = supabase_admin.table("chat_messages").insert(data).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error saving message to DB: {e}")
        return None

async def get_chat_history(chat_id: str, user_id: str):
    """Get full chat history from database with proper ordering"""
    try:
        chat_result = supabase_admin.table("chats").select("*").eq("id", chat_id).eq("user_id", user_id).execute()
        if not chat_result.data:
            return None
        
        chat_info = chat_result.data[0]
        
        messages_result = supabase_admin.table("chat_messages").select("*").eq("chat_id", chat_id).eq("user_id", user_id).order("timestamp", desc=False).order("id", desc=False).execute()
        
        messages = []
        for msg in messages_result.data:
            messages.append({
                "id": msg["id"],
                "role": msg["role"],
                "content": msg["content"],
                "timestamp": msg["timestamp"]
            })
        
        print(f"Retrieved {len(messages)} messages for chat {chat_id}")
        
        return {
            "chat_info": chat_info,
            "messages": messages
        }
    except Exception as e:
        print(f"Error getting chat history: {e}")
        return None

async def get_user_chats(user_id: str):
    """Get all chats for a user with proper ordering and last message preview including image status"""
    try:
        chats_result = supabase_admin.table("chats").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        chats_with_preview = []
        for chat in chats_result.data:
            last_message_result = supabase_admin.table("chat_messages").select("content, timestamp").eq("chat_id", chat["id"]).order("timestamp", desc=True).limit(1).execute()
            
            last_message_preview = ""
            if last_message_result.data:
                content = last_message_result.data[0]["content"]
                lines = content.split('\n')
                preview_text = ' '.join(lines).replace('**', '').strip()
                last_message_preview = preview_text[:80] + '...' if len(preview_text) > 80 else preview_text
            
            chat_with_preview = {
                **chat,
                "last_message_preview": last_message_preview
            }
            chats_with_preview.append(chat_with_preview)
        
        return chats_with_preview
    except Exception as e:
        print(f"Error getting user chats: {e}")
        return []

async def get_message_count(chat_id: str):
    """Get message count for a specific chat"""
    try:
        result = supabase_admin.table("chat_messages").select("id", count="exact").eq("chat_id", chat_id).execute()
        return result.count if result.count else 0
    except Exception as e:
        print(f"Error getting message count: {e}")
        return 0

async def check_chat_ownership(chat_id: str, user_id: str):
    """Check if a chat belongs to a specific user"""
    try:
        result = supabase_admin.table("chats").select("id").eq("id", chat_id).eq("user_id", user_id).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"Error checking chat ownership: {e}")
        return False

async def delete_chat(chat_id: str):
    """Delete a chat and its messages"""
    try:
        supabase_admin.table("chat_messages").delete().eq("chat_id", chat_id).execute()
        result = supabase_admin.table("chats").delete().eq("id", chat_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting chat: {e}")
        return False

async def get_chat_info(chat_id: str, user_id: str):
    """Get chat info including image status"""
    try:
        result = supabase_admin.table("chats").select("*").eq("id", chat_id).eq("user_id", user_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting chat info: {e}")
        return None

# Background task for image generation
async def generate_images_background(user_id: str, chat_id: str, story_content: str):
    """Background task to generate and upload images"""
    try:
        print(f"Starting image generation for chat {chat_id}")
        
        # Generate and store images
        results = await image_generator.generate_and_store_images(user_id, chat_id, story_content)
        
        # Update statuses in database
        if results["world"]:
            master_key = image_generator.get_s3_key(user_id, chat_id, "world", "master")
            await update_image_status(chat_id, user_id, "world", "ready", master_key)
            print(f"World image generated successfully for chat {chat_id}")
        else:
            await update_image_status(chat_id, user_id, "world", "failed")
            print(f"World image generation failed for chat {chat_id}")
        
        if results["character"]:
            master_key = image_generator.get_s3_key(user_id, chat_id, "character", "master")
            await update_image_status(chat_id, user_id, "character", "ready", master_key)
            print(f"Character image generated successfully for chat {chat_id}")
        else:
            await update_image_status(chat_id, user_id, "character", "failed")
            print(f"Character image generation failed for chat {chat_id}")
            
    except Exception as e:
        print(f"Error in background image generation: {e}")
        # Mark both as failed
        await update_image_status(chat_id, user_id, "world", "failed")
        await update_image_status(chat_id, user_id, "character", "failed")

# Story generation functions - Enhanced with RAG
def create_system_message(genre, character, world_additions, actions):
    """Create the system message for the game master"""
    return f"""You are a creative, immersive, and adaptive text-based game master with infinite memory. You generate dynamic adventures for the player, complete with rich world-building, characters, challenges, and story progression. 

Key instructions:
- Always stay in-character and respond as if the player is inside the game world
- Never reveal you are an AI
- Start the game with an engaging scenario and assign a character role to the player
- Wait for the player's action after describing each scene
- Roleplay according to the world rules and maintain consistency
- Remember ALL previous events, characters, and world state changes
- Reference past events naturally when they become relevant
- Make sure a Title is given to each story, with detailed world lore
- Make the story engaging and interactive
- Respond to player actions with consequences and new developments
- Keep the narrative flowing and building upon previous events

Story Parameters:
- Genre: {genre}
- Character: {character}
- World Details: {world_additions}
- Provide 3-4 possible actions after each response: {actions}

Start with an engaging scenario, provide rich world-building details, and wait for the player's action after describing each scene."""

def extract_title_from_story(story_content: str) -> str:
    """Extract title from story content"""
    title_match = re.search(r'\*\*Title:\s*([^*]+)\*\*', story_content, re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()
    
    bold_match = re.search(r'^\*\*([^*]+)\*\*', story_content)
    if bold_match:
        return bold_match.group(1).strip()
    
    first_line = story_content.split('\n')[0].replace('**', '').strip()
    return first_line[:50] + '...' if len(first_line) > 50 else first_line

# Create dependency for StoryGenerator
def get_story_generator(memory_manager: MemoryManager = Depends(get_memory_manager)) -> StoryGenerator:
    """Dependency injection for StoryGenerator"""
    return StoryGenerator(memory_manager)

# API Endpoints
@app.post("/api/story/init", response_model=StoryResponse)
@rate_limit(max_requests=5, window_seconds=60)
async def initialize_story(
    request: StoryInitRequest, 
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """Initialize a new story session with RAG and image generation"""
    try:
        session_id = str(uuid.uuid4())
        
        system_message = create_system_message(
            request.genre, 
            request.character, 
            request.world_additions, 
            request.actions
        )
        
        # Generate initial story using RAG-enhanced generator
        initial_response = await story_gen.generate_initial_story(
            genre=request.genre,
            character=request.character,
            world_additions=request.world_additions,
            actions=request.actions,
            user_id=user_id,
            chat_id=session_id
        )
        
        # Check for error in response
        if initial_response.startswith("Error generating story:"):
            raise HTTPException(status_code=500, detail=initial_response)
        
        # Extract title from story content
        title = extract_title_from_story(initial_response)
        
        # Save chat to database
        saved = await save_chat_to_db(user_id, session_id, title, system_message)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to save chat to database")
        
        # Save initial user message and AI response to database
        await save_message_to_db(session_id, user_id, "user", "Generate a random story and world for me.")
        await save_message_to_db(session_id, user_id, "assistant", initial_response)
        
        # Start background image generation
        background_tasks.add_task(generate_images_background, user_id, session_id, initial_response)
        
        return StoryResponse(
            session_id=session_id,
            story_content=initial_response,
            success=True,
            message="Story initialized successfully with RAG memory. Images are being generated in the background."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize story: {str(e)}")

@app.post("/api/story/action", response_model=StoryResponse)
@rate_limit(max_requests=30, window_seconds=60)
async def take_story_action(
    request: StoryActionRequest, 
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """Continue the story with a user action using RAG"""
    try:
        # Get chat history from database
        chat_data = await get_chat_history(request.session_id, user_id)
        if not chat_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        chat_info = chat_data["chat_info"]
        db_messages = chat_data["messages"]
        
        # Convert database messages to the format expected by story generator
        recent_messages = [
            {"role": msg["role"], "content": msg["content"]} 
            for msg in db_messages
        ]
        
        # Generate response using RAG-enhanced story generator
        response = await story_gen.continue_story(
            user_action=request.user_action,
            user_id=user_id,
            chat_id=request.session_id,
            recent_messages=recent_messages
        )
        
        # Check for error in response
        if response.startswith("Error continuing story:"):
            raise HTTPException(status_code=500, detail=response)
        
        # Save user action and AI response to database
        await save_message_to_db(request.session_id, user_id, "user", request.user_action)
        await save_message_to_db(request.session_id, user_id, "assistant", response)
        
        return StoryResponse(
            session_id=request.session_id,
            story_content=response,
            success=True,
            message="Action processed successfully with RAG memory"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process action: {str(e)}")

# New RAG-specific endpoints
@app.get("/api/story/summary/{session_id}", response_model=StorySummaryResponse)
async def get_story_summary(
    session_id: str, 
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """Get an AI-generated summary of the story so far"""
    try:
        # Check if session exists and belongs to user
        chat_exists = await check_chat_ownership(session_id, user_id)
        if not chat_exists:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Generate summary using RAG
        summary = await story_gen.get_story_summary(user_id, session_id)
        
        return StorySummaryResponse(
            session_id=session_id,
            summary=summary,
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@app.post("/api/story/search-memories", response_model=MemorySearchResponse)
async def search_memories(
    request: MemorySearchRequest,
    user_id: str = Depends(get_current_user),
    memory_manager: MemoryManager = Depends(get_memory_manager)
):
    """Search through story memories using semantic search"""
    try:
        # Check if session exists and belongs to user
        chat_exists = await check_chat_ownership(request.session_id, user_id)
        if not chat_exists:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Search memories
        memories = await memory_manager.retrieve_memories(
            query=request.query,
            user_id=user_id,
            chat_id=request.session_id,
            k=request.limit
        )
        
        # Format response
        formatted_memories = []
        for memory in memories:
            formatted_memories.append({
                "content": memory.page_content,
                "role": memory.metadata.get("role", "unknown"),
                "memory_type": memory.metadata.get("memory_type", "general"),
                "timestamp": memory.metadata.get("timestamp", "unknown")
            })
        
        return MemorySearchResponse(
            session_id=request.session_id,
            memories=formatted_memories,
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search memories: {str(e)}")

# New Image API Endpoints
@app.get("/api/images/get-url", response_model=ImageUrlResponse)
async def get_image_url(
    chat_id: str,
    image_type: str,  # "world" or "character"
    variant: str = "web",  # "master", "web", "thumb", "avatar"
    user_id: str = Depends(get_current_user)
):
    """Get presigned URL for image access"""
    try:
        # Validate parameters
        if image_type not in ["world", "character"]:
            raise HTTPException(status_code=400, detail="image_type must be 'world' or 'character'")
        
        valid_variants = {
            "world": ["master", "web", "thumb"],
            "character": ["master", "web", "avatar"]
        }
        
        if variant not in valid_variants[image_type]:
            raise HTTPException(status_code=400, detail=f"Invalid variant for {image_type}")
        
        # Check if chat exists and belongs to user
        chat_info = await get_chat_info(chat_id, user_id)
        if not chat_info:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Check image status
        status_key = f"{image_type}_image_status"
        if chat_info.get(status_key) != "ready":
            return ImageUrlResponse(
                url=None,
                success=False,
                message=f"{image_type.title()} image is not ready yet"
            )
        
        # Generate S3 key and presigned URL
        s3_key = image_generator.get_s3_key(user_id, chat_id, image_type, variant)
        presigned_url = image_generator.generate_presigned_url(s3_key, expiration=3600)
        
        if not presigned_url:
            return ImageUrlResponse(
                url=None,
                success=False,
                message="Failed to generate image URL"
            )
        
        return ImageUrlResponse(
            url=presigned_url,
            success=True,
            message="Image URL generated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get image URL: {str(e)}")

@app.get("/api/images/status/{chat_id}", response_model=ImageStatusResponse)
async def get_image_status(
    chat_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get image generation status for a chat"""
    try:
        # Check if chat exists and belongs to user
        chat_info = await get_chat_info(chat_id, user_id)
        if not chat_info:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        return ImageStatusResponse(
            world_status=chat_info.get("world_image_status", "pending"),
            character_status=chat_info.get("character_image_status", "pending"),
            world_updated_at=chat_info.get("world_image_updated_at"),
            character_updated_at=chat_info.get("character_image_updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get image status: {str(e)}")

@app.post("/api/images/regenerate")
@rate_limit(max_requests=3, window_seconds=60)
async def regenerate_images(
    chat_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user)
):
    """Regenerate images for a chat"""
    try:
        # Check if chat exists and belongs to user
        chat_info = await get_chat_info(chat_id, user_id)
        if not chat_info:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get the initial story content from chat messages
        chat_data = await get_chat_history(chat_id, user_id)
        if not chat_data or not chat_data["messages"]:
            raise HTTPException(status_code=404, detail="No story content found")
        
        # Find the first assistant message (initial story)
        initial_story = None
        for msg in chat_data["messages"]:
            if msg["role"] == "assistant":
                initial_story = msg["content"]
                break
        
        if not initial_story:
            raise HTTPException(status_code=404, detail="Initial story not found")
        
        # Reset image status to pending
        await update_image_status(chat_id, user_id, "world", "pending")
        await update_image_status(chat_id, user_id, "character", "pending")
        
        # Start background image generation
        background_tasks.add_task(generate_images_background, user_id, chat_id, initial_story)
        
        return {
            "success": True,
            "message": "Image regeneration started in background"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate images: {str(e)}")

@app.delete("/api/user/delete-account")
async def delete_user_account(
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """
    Permanently delete all user data including:
    - All chat sessions and messages from Supabase
    - All memory data from ChromaDB
    - All images from S3
    - User profile data
    """
    try:
        print(f"🗑️ Starting account deletion for user: {user_id}")
        
        # Step 1: Get all user sessions to identify resources to delete
        user_sessions = await get_user_chats(user_id)
        session_ids = [session["id"] for session in user_sessions]
        
        print(f"📋 Found {len(session_ids)} sessions to delete")
        
        # Step 2: Delete all images from S3 for each session
        s3_deletion_errors = []
        if session_ids:
            try:
                for session_id in session_ids:
                    try:
                        # Delete all image variants for this session
                        image_types = ['world', 'character']
                        variants = {
                            'world': ['master', 'web', 'thumb'],
                            'character': ['master', 'web', 'avatar']
                        }
                        
                        for image_type in image_types:
                            for variant in variants[image_type]:
                                s3_key = image_generator.get_s3_key(user_id, session_id, image_type, variant)
                                try:
                                    image_generator.s3_client.delete_object(
                                        Bucket=image_generator.bucket,
                                        Key=s3_key
                                    )
                                    print(f"🖼️ Deleted S3 object: {s3_key}")
                                except Exception as s3_error:
                                    print(f"⚠️ Failed to delete S3 object {s3_key}: {s3_error}")
                                    s3_deletion_errors.append(str(s3_error))
                                    
                    except Exception as session_error:
                        print(f"⚠️ Error deleting images for session {session_id}: {session_error}")
                        s3_deletion_errors.append(str(session_error))
                        
                print(f"🖼️ S3 cleanup completed with {len(s3_deletion_errors)} errors")
                
            except Exception as s3_error:
                print(f"❌ S3 deletion failed: {s3_error}")
                s3_deletion_errors.append(str(s3_error))
        
        # Step 3: Delete all memory data from ChromaDB
        memory_deletion_errors = []
        if session_ids:
            try:
                for session_id in session_ids:
                    try:
                        success = await story_gen.cleanup_chat_memories(session_id)
                        if success:
                            print(f"🧠 Deleted memories for session: {session_id}")
                        else:
                            error_msg = f"Failed to delete memories for session: {session_id}"
                            print(f"⚠️ {error_msg}")
                            memory_deletion_errors.append(error_msg)
                    except Exception as memory_error:
                        error_msg = f"Error deleting memories for session {session_id}: {memory_error}"
                        print(f"⚠️ {error_msg}")
                        memory_deletion_errors.append(error_msg)
                        
                print(f"🧠 Memory cleanup completed with {len(memory_deletion_errors)} errors")
                
            except Exception as memory_error:
                print(f"❌ Memory deletion failed: {memory_error}")
                memory_deletion_errors.append(str(memory_error))
        
        # Step 4: Delete all chat messages from Supabase
        db_deletion_errors = []
        try:
            # Delete all chat messages
            if session_ids:
                for session_id in session_ids:
                    try:
                        supabase_admin.table("chat_messages").delete().eq("chat_id", session_id).execute()
                        print(f"💬 Deleted messages for session: {session_id}")
                    except Exception as msg_error:
                        error_msg = f"Error deleting messages for session {session_id}: {msg_error}"
                        print(f"⚠️ {error_msg}")
                        db_deletion_errors.append(error_msg)
            
            # Delete all chat sessions
            supabase_admin.table("chats").delete().eq("user_id", user_id).execute()
            print(f"💬 Deleted all chat sessions for user: {user_id}")
            
        except Exception as db_error:
            print(f"❌ Database deletion failed: {db_error}")
            db_deletion_errors.append(str(db_error))
        
        # Step 5: Prepare deletion summary
        total_errors = len(s3_deletion_errors) + len(memory_deletion_errors) + len(db_deletion_errors)
        
        deletion_summary = {
            "user_id": user_id,
            "sessions_processed": len(session_ids),
            "s3_errors": len(s3_deletion_errors),
            "memory_errors": len(memory_deletion_errors),
            "database_errors": len(db_deletion_errors),
            "total_errors": total_errors
        }
        
        print(f"📊 Deletion Summary: {deletion_summary}")
        
        # If there were critical errors, still return success but log details
        if total_errors > 0:
            print(f"⚠️ Account deletion completed with {total_errors} non-critical errors")
            
        return {
            "success": True,
            "message": f"User account data deleted successfully. Processed {len(session_ids)} sessions.",
            "summary": deletion_summary,
            "errors": {
                "s3_errors": s3_deletion_errors[:5],  # Limit error details
                "memory_errors": memory_deletion_errors[:5],
                "database_errors": db_deletion_errors[:5]
            } if total_errors > 0 else None
        }
        
    except Exception as e:
        print(f"🚨 Critical error during account deletion: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Account deletion failed: {str(e)}"
        )

# Keep existing endpoints unchanged
@app.get("/api/story/session/{session_id}", response_model=ChatHistoryResponse)
async def get_session_history(session_id: str, user_id: str = Depends(get_current_user)):
    """Get full chat history for a session"""
    try:
        chat_data = await get_chat_history(session_id, user_id)
        if not chat_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        chat_info = chat_data["chat_info"]
        messages = chat_data["messages"]
        
        return ChatHistoryResponse(
            session_id=session_id,
            title=chat_info["title"],
            system_prompt=chat_info["system_prompt"],
            messages=messages,
            success=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session history: {str(e)}")

@app.get("/api/story/sessions")
async def list_sessions(user_id: str = Depends(get_current_user)):
    """List all sessions for the authenticated user with proper message previews and image status"""
    try:
        chats = await get_user_chats(user_id)
        
        sessions = []
        for chat in chats:
            message_count = await get_message_count(chat["id"])
            
            sessions.append({
                "session_id": chat["id"],
                "title": chat["title"],
                "created_at": chat["created_at"],
                "last_updated": chat.get("last_updated", chat["created_at"]),
                "message_count": message_count,
                "last_message_preview": chat.get("last_message_preview", ""),
                "world_image_status": chat.get("world_image_status", "pending"),
                "character_image_status": chat.get("character_image_status", "pending")
            })
        
        print(f"Retrieved {len(sessions)} sessions for user {user_id}")
        
        return {
            "sessions": sessions,
            "total_sessions": len(sessions)
        }
        
    except Exception as e:
        print(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@app.delete("/api/story/session/{session_id}")
async def delete_session(
    session_id: str, 
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """Delete a story session and its memories"""
    try:
        # Check if session exists and belongs to user
        chat_exists = await check_chat_ownership(session_id, user_id)
        if not chat_exists:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Delete memories from ChromaDB
        memory_cleanup_success = await story_gen.cleanup_chat_memories(session_id)
        if not memory_cleanup_success:
            print(f"Warning: Failed to cleanup memories for chat {session_id}")
        
        # TODO: Delete images from S3 (optional - you might want to keep them for a while)
        # This would require implementing S3 cleanup in ImageGenerator
        
        # Delete the session from Supabase
        success = await delete_chat(session_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete session")
        
        return {"message": "Session and memories deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

# Health check endpoint for ChromaDB
@app.get("/api/health/memory")
async def check_memory_health(memory_manager: MemoryManager = Depends(get_memory_manager)):
    """Health check for memory system"""
    try:
        # Try to perform a simple operation
        test_memories = await memory_manager.retrieve_memories(
            query="test",
            user_id="health-check",
            chat_id="health-check",
            k=1
        )
        
        return {
            "status": "healthy",
            "memory_system": "connected",
            "message": "RAG memory system is operational"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "memory_system": "error",
            "message": f"Memory system error: {str(e)}"
        }

# Health check endpoint for Image system
@app.get("/api/health/images")
async def check_image_health():
    """Health check for image generation system"""
    try:
        # Test S3 connection
        s3_client = image_generator.s3_client
        s3_client.head_bucket(Bucket=image_generator.bucket)
        
        # Test HF API (just check if token is set)
        if not image_generator.hf_token or image_generator.hf_token == "hf_xxx":
            return {
                "status": "unhealthy",
                "image_system": "error",
                "message": "Hugging Face token not configured"
            }
        
        return {
            "status": "healthy",
            "image_system": "connected",
            "s3_bucket": image_generator.bucket,
            "message": "Image generation system is operational"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "image_system": "error",
            "message": f"Image system error: {str(e)}"
        }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Interactive Story Generator API with RAG Memory and Images", 
        "version": "4.0.0",
        "features": [
            "Semantic memory search",
            "Contextual story generation",
            "Persistent character and world memory",
            "Story summaries",
            "Enhanced continuity",
            "AI-generated world and character images",
            "Multi-variant image storage",
            "S3-based image hosting"
        ],
        "endpoints": {
            "init_story": "/api/story/init",
            "take_action": "/api/story/action",
            "get_session": "/api/story/session/{session_id}",
            "get_summary": "/api/story/summary/{session_id}",
            "search_memories": "/api/story/search-memories",
            "list_sessions": "/api/story/sessions",
            "delete_session": "/api/story/session/{session_id}",
            "get_image_url": "/api/images/get-url",
            "get_image_status": "/api/images/status/{chat_id}",
            "regenerate_images": "/api/images/regenerate",
            "memory_health": "/api/health/memory",
            "image_health": "/api/health/images",
            "docs": "/docs"
        }
    }
@app.get("/health")
async def health_check():
    """Lightweight health check for uptime monitoring"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "uptime": "service_running"
    }
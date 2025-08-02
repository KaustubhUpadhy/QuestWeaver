from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
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

# Import our new RAG components
from chroma_connection import get_memory_manager, MemoryManager
from story_generator import StoryGenerator

# Load environment variables
load_dotenv()

# Initialize OpenAI (keeping for compatibility)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase with service role key for admin operations
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

if not all([supabase_url, supabase_service_key, supabase_anon_key]):
    raise ValueError("Missing Supabase environment variables")

# Initialize Supabase clients
try:
    supabase_admin: Client = create_client(
        supabase_url, 
        supabase_service_key,
        options={
            "schema": "public",
            "auto_refresh_token": True,
            "persist_session": True
        }
    )
    supabase_client: Client = create_client(
        supabase_url, 
        supabase_anon_key,
        options={
            "schema": "public",
            "auto_refresh_token": True,
            "persist_session": True
        }
    )
except Exception as e:
    print(f"Error initializing Supabase clients: {e}")
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
    supabase_client: Client = create_client(supabase_url, supabase_anon_key)

app = FastAPI(title="Interactive Story Generator API with RAG", version="3.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

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

# Authentication helper function (unchanged)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        response = supabase_client.auth.get_user(token)
        
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return response.user.id
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Database helper functions (keeping existing ones)
async def save_chat_to_db(user_id: str, session_id: str, title: str, system_prompt: str):
    """Save a new chat session to database"""
    try:
        data = {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "system_prompt": system_prompt,
            "created_at": datetime.now().isoformat()
        }
        
        result = supabase_admin.table("chats").insert(data).execute()
        return result.data is not None
    except Exception as e:
        print(f"Error saving chat to DB: {e}")
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
    """Get all chats for a user with proper ordering and last message preview"""
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
async def initialize_story(
    request: StoryInitRequest, 
    user_id: str = Depends(get_current_user),
    story_gen: StoryGenerator = Depends(get_story_generator)
):
    """Initialize a new story session with RAG"""
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
        
        return StoryResponse(
            session_id=session_id,
            story_content=initial_response,
            success=True,
            message="Story initialized successfully with RAG memory"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize story: {str(e)}")

@app.post("/api/story/action", response_model=StoryResponse)
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
    """List all sessions for the authenticated user with proper message previews"""
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
                "last_message_preview": chat.get("last_message_preview", "")
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

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Interactive Story Generator API with RAG Memory", 
        "version": "3.0.0",
        "features": [
            "Semantic memory search",
            "Contextual story generation",
            "Persistent character and world memory",
            "Story summaries",
            "Enhanced continuity"
        ],
        "endpoints": {
            "init_story": "/api/story/init",
            "take_action": "/api/story/action",
            "get_session": "/api/story/session/{session_id}",
            "get_summary": "/api/story/summary/{session_id}",
            "search_memories": "/api/story/search-memories",
            "list_sessions": "/api/story/sessions",
            "delete_session": "/api/story/session/{session_id}",
            "memory_health": "/api/health/memory",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
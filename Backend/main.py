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

# Load environment variables
load_dotenv()

# Initialize OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase with service role key for admin operations
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Service role for admin operations
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")  # For client-side operations

if not all([supabase_url, supabase_service_key, supabase_anon_key]):
    raise ValueError("Missing Supabase environment variables")

# Initialize Supabase clients with minimal options to avoid proxy error
try:
    # Service role client for admin operations (inserting/fetching all data)
    supabase_admin: Client = create_client(
        supabase_url, 
        supabase_service_key,
        options={
            "schema": "public",
            "auto_refresh_token": True,
            "persist_session": True
        }
    )
    # Anon client for user-specific operations
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
    # Fallback to basic initialization
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
    supabase_client: Client = create_client(supabase_url, supabase_anon_key)

app = FastAPI(title="Interactive Story Generator API", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Pydantic models
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

# Authentication helper function
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Verify the JWT token with Supabase
        token = credentials.credentials
        response = supabase_client.auth.get_user(token)
        
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return response.user.id
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Database helper functions
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
    """Get full chat history from database"""
    try:
        # Get chat info
        chat_result = supabase_admin.table("chats").select("*").eq("id", chat_id).eq("user_id", user_id).execute()
        if not chat_result.data:
            return None
        
        chat_info = chat_result.data[0]
        
        # Get messages ordered by sequence number
        messages_result = supabase_admin.table("chat_messages").select("*").eq("chat_id", chat_id).order("sequence_number").execute()
        
        messages = []
        for msg in messages_result.data:
            messages.append({
                "id": msg["id"],
                "role": msg["role"],
                "content": msg["content"],
                "timestamp": msg["timestamp"]
            })
        
        return {
            "chat_info": chat_info,
            "messages": messages
        }
    except Exception as e:
        print(f"Error getting chat history: {e}")
        return None

async def get_user_chats(user_id: str):
    """Get all chats for a user"""
    try:
        result = supabase_admin.table("chats").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return result.data
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
        # Delete messages first (due to foreign key constraint)
        supabase_admin.table("chat_messages").delete().eq("chat_id", chat_id).execute()
        
        # Delete chat
        result = supabase_admin.table("chats").delete().eq("id", chat_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting chat: {e}")
        return False

# Story generation functions
def create_system_message(genre, character, world_additions, actions):
    """Create the system message for the game master"""
    return f"""You are a creative, immersive, and adaptive text-based game master. You generate dynamic adventures for the player, complete with rich world-building, characters, challenges, and story progression. 

Key instructions:
- Always stay in-character and respond as if the player is inside the game world
- Never reveal you are an AI
- Start the game with an engaging scenario based on the selected genre and assign a character role to the player. 
- Wait for the player's action after describing the scene. 
- Roleplay according to the world rules and the type of world. 
- Make sure a Title is given to each story, with the world, kingdoms, factions and any other character lore or story related role laid out in detailed.
- Make the story engaging and interactive
- Respond to player actions with consequences and new developments
- Keep the narrative flowing and building upon previous events
- Create a detailed title and world lore at the start

Story Parameters:
- Genre: {genre}
- Character: {character}
- World Details: {world_additions}
- Provide 3-4 possible actions after each response: {actions}

Start with an engaging scenario, provide rich world-building details, and wait for the player's action after describing each scene."""

def generate_initial_story(messages):
    """Generate the initial story setup"""
    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1200,
            temperature=1.0
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Error generating story: {str(e)}"

def continue_story(messages):
    """Continue the story based on user input"""
    try:
        # Limit conversation history to prevent token overflow
        # Keep system message + last 10 exchanges (20 messages)
        if len(messages) > 21:
            messages = [messages[0]] + messages[-20:]
        
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=800,
            temperature=1.0
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Error continuing story: {str(e)}"

def extract_title_from_story(story_content: str) -> str:
    """Extract title from story content"""
    # Look for **Title: something** pattern
    title_match = re.search(r'\*\*Title:\s*([^*]+)\*\*', story_content, re.IGNORECASE)
    if title_match:
        return title_match.group(1).strip()
    
    # Look for any text between ** at the beginning
    bold_match = re.search(r'^\*\*([^*]+)\*\*', story_content)
    if bold_match:
        return bold_match.group(1).strip()
    
    # Fallback: take first line and limit length
    first_line = story_content.split('\n')[0].replace('**', '').strip()
    return first_line[:50] + '...' if len(first_line) > 50 else first_line

# API Endpoints
@app.post("/api/story/init", response_model=StoryResponse)
async def initialize_story(request: StoryInitRequest, user_id: str = Depends(get_current_user)):
    """Initialize a new story session"""
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        
        # Create system message with user preferences
        system_message = create_system_message(
            request.genre, 
            request.character, 
            request.world_additions, 
            request.actions
        )
        
        # Initialize conversation with system message
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": "Generate a random story and world for me."}
        ]
        
        # Generate initial story
        initial_response = generate_initial_story(messages)
        
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
            message="Story initialized successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize story: {str(e)}")

@app.post("/api/story/action", response_model=StoryResponse)
async def take_story_action(request: StoryActionRequest, user_id: str = Depends(get_current_user)):
    """Continue the story with a user action"""
    try:
        # Get chat history from database
        chat_data = await get_chat_history(request.session_id, user_id)
        if not chat_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        chat_info = chat_data["chat_info"]
        db_messages = chat_data["messages"]
        
        # Rebuild messages array for OpenAI
        messages = [{"role": "system", "content": chat_info["system_prompt"]}]
        
        # Add all previous messages
        for msg in db_messages:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add new user action
        messages.append({"role": "user", "content": request.user_action})
        
        # Generate response
        response = continue_story(messages)
        
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
            message="Action processed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process action: {str(e)}")

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
    """List all sessions for the authenticated user"""
    try:
        chats = await get_user_chats(user_id)
        
        # Get message count for each chat
        sessions = []
        for chat in chats:
            message_count = await get_message_count(chat["id"])
            
            sessions.append({
                "session_id": chat["id"],
                "title": chat["title"],
                "created_at": chat["created_at"],
                "last_updated": chat.get("last_updated", chat["created_at"]),
                "message_count": message_count
            })
        
        return {
            "sessions": sessions,
            "total_sessions": len(sessions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@app.delete("/api/story/session/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    """Delete a story session"""
    try:
        # Check if session exists and belongs to user
        chat_exists = await check_chat_ownership(session_id, user_id)
        if not chat_exists:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Delete the session (messages will be deleted automatically due to CASCADE)
        success = await delete_chat(session_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete session")
        
        return {"message": "Session deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Interactive Story Generator API with Supabase", 
        "version": "2.0.0",
        "endpoints": {
            "init_story": "/api/story/init",
            "take_action": "/api/story/action",
            "get_session": "/api/story/session/{session_id}",
            "list_sessions": "/api/story/sessions",
            "delete_session": "/api/story/session/{session_id}",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
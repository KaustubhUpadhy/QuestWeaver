from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="Interactive Story Generator API", version="1.0.0")

# Add CORS middleware for web app integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for sessions (use database in production)
story_sessions: Dict[str, Dict] = {}

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
    created_at: str
    last_updated: str
    message_count: int

# Core functions from your original code (unchanged)
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
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=800,
            temperature=1.0
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"Error continuing story: {str(e)}"

# API Endpoints
@app.post("/api/story/init", response_model=StoryResponse)
async def initialize_story(request: StoryInitRequest):
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
            {
                "role": "system", 
                "content": system_message
            },
            {
                "role": "user",
                "content": "Generate a random story and world for me."
            }
        ]
        
        # Generate initial story
        initial_response = generate_initial_story(messages)
        
        # Check for error in response
        if initial_response.startswith("Error generating story:"):
            raise HTTPException(status_code=500, detail=initial_response)
        
        # Add the assistant's response to conversation history
        messages.append({"role": "assistant", "content": initial_response})
        
        # Store session data
        story_sessions[session_id] = {
            "messages": messages,
            "created_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "preferences": {
                "genre": request.genre,
                "character": request.character,
                "world_additions": request.world_additions,
                "actions": request.actions
            }
        }
        
        return StoryResponse(
            session_id=session_id,
            story_content=initial_response,
            success=True,
            message="Story initialized successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize story: {str(e)}")

@app.post("/api/story/action", response_model=StoryResponse)
async def take_story_action(request: StoryActionRequest):
    """Continue the story with a user action"""
    try:
        # Check if session exists
        if request.session_id not in story_sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get session data
        session = story_sessions[request.session_id]
        messages = session["messages"]
        
        # Add user action to conversation
        messages.append({"role": "user", "content": request.user_action})
        
        # Generate response
        response = continue_story(messages)
        
        # Check for error in response
        if response.startswith("Error continuing story:"):
            raise HTTPException(status_code=500, detail=response)
        
        # Add assistant response to conversation
        messages.append({"role": "assistant", "content": response})
        
        # Limit conversation history to prevent token overflow
        # Keep system message + last 10 exchanges (20 messages)
        if len(messages) > 21:
            messages = [messages[0]] + messages[-20:]
        
        # Update session
        session["messages"] = messages
        session["last_updated"] = datetime.now().isoformat()
        
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

@app.get("/api/story/session/{session_id}", response_model=SessionInfo)
async def get_session_info(session_id: str):
    """Get information about a story session"""
    if session_id not in story_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = story_sessions[session_id]
    return SessionInfo(
        session_id=session_id,
        created_at=session["created_at"],
        last_updated=session["last_updated"],
        message_count=len(session["messages"])
    )

@app.get("/api/story/sessions")
async def list_sessions():
    """List all active sessions"""
    return {
        "sessions": [
            {
                "session_id": sid,
                "created_at": session["created_at"],
                "last_updated": session["last_updated"],
                "message_count": len(session["messages"])
            }
            for sid, session in story_sessions.items()
        ],
        "total_sessions": len(story_sessions)
    }

@app.delete("/api/story/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a story session"""
    if session_id not in story_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del story_sessions[session_id]
    return {"message": "Session deleted successfully"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Interactive Story Generator API", 
        "version": "1.0.0",
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
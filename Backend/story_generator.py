from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from langchain.memory import ConversationSummaryBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.schema import Document
from typing import List, Dict, Any, Optional, Tuple
import os
from dotenv import load_dotenv
import logging
from chroma_connection import MemoryManager

load_dotenv()
logger = logging.getLogger(__name__)

class StoryGenerator:
    """Enhanced story generator with RAG capabilities"""
    
    def __init__(self, memory_manager: MemoryManager):
        self.llm = ChatOpenAI(
            temperature=1.0,
            model_name="gpt-4o",
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        self.memory_manager = memory_manager
        
        # Create prompt template with memory injection
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", self._get_system_prompt_template()),
            MessagesPlaceholder(variable_name="memory_context"),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{user_input}")
        ])
    
    def _get_system_prompt_template(self) -> str:
        """Get the enhanced system prompt with memory awareness - INCLUDES ACTION REQUIREMENT"""
        return """You are a creative, immersive, and adaptive text-based game master with perfect memory. You generate dynamic adventures for the player, complete with rich world-building, characters, challenges, and story progression.

Key instructions:
- Always stay in-character and respond as if the player is inside the game world
- Never reveal you are an AI
- Use the provided memory context to maintain consistency with past events
- Remember character relationships, world state, and previous player actions
- Reference past events naturally when relevant to the current situation
- Build upon established lore and character development
- Make the story engaging and interactive
- Respond to player actions with consequences and new developments
- Keep the narrative flowing and building upon previous events
- Create detailed titles and world lore that evolve with the story
- ALWAYS provide 3-4 numbered action options at the end of each response
- Wait for the player's action after describing each scene

IMPORTANT: 
1. Use the memory context below to inform your responses and maintain story continuity
2. ALWAYS end your responses with 3-4 numbered action options for the player
3. Make actions specific to the current situation and meaningful to the story

Example format:
[Your story response here]

What do you do?
1. [Specific action option]
2. [Specific action option] 
3. [Specific action option]
4. [Specific action option]
"""

    def _build_memory_context(self, memories: List[Document]) -> str:
        """Build context string from retrieved memories"""
        if not memories:
            return "No previous context available."
        
        context_parts = []
        for i, memory in enumerate(memories, 1):
            role = memory.metadata.get('role', 'unknown')
            memory_type = memory.metadata.get('memory_type', 'general')
            content = memory.page_content
            
            context_parts.append(f"Memory {i} [{role}, {memory_type}]: {content}")
        
        return "\n".join(context_parts)
    
    def _extract_key_events(self, content: str, role: str) -> List[Dict[str, Any]]:
        """Extract key events from content for enhanced memory storage"""
        events = []
        
        # Basic event extraction - you can enhance this with NLP
        if role == "user":
            # User actions are typically important
            events.append({
                "memory_type": "action",
                "description": f"Player action: {content}"
            })
        elif role == "assistant":
            # Extract key story elements from AI responses
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('**') and line.endswith('**'):
                    # Likely a title or important heading
                    events.append({
                        "memory_type": "lore",
                        "description": f"Story element: {line}"
                    })
                elif any(keyword in line.lower() for keyword in ['meets', 'finds', 'discovers', 'enters', 'defeats', 'encounters']):
                    # Potential key story events
                    events.append({
                        "memory_type": "event",
                        "description": f"Story event: {line}"
                    })
        
        return events
    
    async def generate_initial_story(
        self,
        genre: str,
        character: str,
        world_additions: str,
        actions: str,
        user_id: str,
        chat_id: str
    ) -> str:
        """Generate initial story with memory storage - FIXED to include actions"""
        try:
            # Create comprehensive system prompt that ensures actions are included
            system_prompt = f"""You are a creative, immersive, and adaptive text-based game master. You generate dynamic adventures for the player, complete with rich world-building, characters, challenges, and story progression. 

Key instructions:
- Always stay in-character and respond as if the player is inside the game world
- Never reveal you are an AI
- Start the game with an engaging scenario based on the selected genre and assign a character role to the player
- Wait for the player's action after describing the scene
- Roleplay according to the world rules and the type of world
- Make sure a Title is given to each story, with the world, kingdoms, factions and any other character lore or story related role laid out in detail
- Make the story engaging and interactive
- Respond to player actions with consequences and new developments
- Keep the narrative flowing and building upon previous events
- Create a detailed title and world lore at the start
- ALWAYS provide 3-4 possible actions at the end of each response

Story Parameters:
- Genre: {genre}
- Character: {character}
- World Details: {world_additions}
- Provide 3-4 possible actions after each response: {actions}

Generate a random story and world for me. Start with an engaging scenario, provide rich world-building details, create a compelling title, and ALWAYS end with exactly 3-4 numbered action options for the player to choose from.

Required format:
**Title: [Your Title]**

[Your story content with world-building and character setup...]

What do you do?
1. [Action option 1]
2. [Action option 2]
3. [Action option 3]
4. [Action option 4]"""
            
            # Generate story with explicit action requirement
            messages = [HumanMessage(content=system_prompt)]
            response = await self.llm.agenerate([messages])
            story_content = response.generations[0][0].text
            
            # Store initial story in memory
            await self.memory_manager.store_memory(
                content=story_content,
                user_id=user_id,
                chat_id=chat_id,
                role="assistant",
                memory_type="initial_story",
                additional_metadata={
                    "genre": genre,
                    "character": character,
                    "world_additions": world_additions
                }
            )
            
            # Extract and store key events
            events = self._extract_key_events(story_content, "assistant")
            for event in events:
                await self.memory_manager.store_memory(
                    content=event["description"],
                    user_id=user_id,
                    chat_id=chat_id,
                    role="assistant",
                    memory_type=event["memory_type"]
                )
            
            return story_content
            
        except Exception as e:
            logger.error(f"Error generating initial story: {e}")
            return f"Error generating story: {str(e)}"
    
    async def continue_story(
        self,
        user_action: str,
        user_id: str,
        chat_id: str,
        recent_messages: List[Dict[str, str]] = None
    ) -> str:
        """Continue story with RAG-enhanced context - FIXED to include actions"""
        try:
            # Store user action in memory first
            await self.memory_manager.store_memory(
                content=user_action,
                user_id=user_id,
                chat_id=chat_id,
                role="user",
                memory_type="action"
            )
            
            # Retrieve relevant memories based on user action
            relevant_memories = await self.memory_manager.retrieve_memories(
                query=user_action,
                user_id=user_id,
                chat_id=chat_id,
                k=5,
                memory_types=["action", "event", "lore", "npc", "location"]
            )
            
            # Get recent conversation context
            recent_memories = await self.memory_manager.get_recent_memories(
                user_id=user_id,
                chat_id=chat_id,
                limit=6  # Last 3 exchanges
            )
            
            # Build memory context
            memory_context = self._build_memory_context(relevant_memories)
            
            # Build recent chat history
            chat_history = []
            if recent_messages:
                for msg in recent_messages[-6:]:  # Last 3 exchanges
                    if msg["role"] == "user":
                        chat_history.append(HumanMessage(content=msg["content"]))
                    else:
                        chat_history.append(AIMessage(content=msg["content"]))
            
            # Create enhanced prompt that ensures actions are included
            enhanced_prompt = f"""Based on the memory context and recent conversation, respond to the player's action: "{user_action}"

MEMORY CONTEXT:
{memory_context}

REQUIREMENTS:
- Stay consistent with the established world and story
- Reference relevant past events naturally  
- Respond to the player's action with consequences and story advancement
- Make the story engaging and immersive
- ALWAYS end with exactly 3-4 numbered action options for the player
- Make actions specific to the current situation

Format your response exactly like this:
[Your story response to the player's action - describe what happens, consequences, new developments]

What do you do?
1. [Specific action option related to current situation]
2. [Specific action option related to current situation]
3. [Specific action option related to current situation]
4. [Specific action option related to current situation]"""
            
            # Generate response
            messages = chat_history + [HumanMessage(content=enhanced_prompt)]
            response = await self.llm.agenerate([messages])
            story_response = response.generations[0][0].text
            
            # Store AI response in memory
            await self.memory_manager.store_memory(
                content=story_response,
                user_id=user_id,
                chat_id=chat_id,
                role="assistant",
                memory_type="response"
            )
            
            # Extract and store key events from the response
            events = self._extract_key_events(story_response, "assistant")
            for event in events:
                await self.memory_manager.store_memory(
                    content=event["description"],
                    user_id=user_id,
                    chat_id=chat_id,
                    role="assistant",
                    memory_type=event["memory_type"]
                )
            
            return story_response
            
        except Exception as e:
            logger.error(f"Error continuing story: {e}")
            return f"Error continuing story: {str(e)}"
    
    async def get_story_summary(
        self,
        user_id: str,
        chat_id: str
    ) -> str:
        """Generate a summary of the story so far"""
        try:
            # Get all story memories
            all_memories = await self.memory_manager.retrieve_memories(
                query="story summary events",
                user_id=user_id,
                chat_id=chat_id,
                k=20,
                memory_types=["initial_story", "event", "lore", "action"]
            )
            
            if not all_memories:
                return "No story events found."
            
            # Build context for summarization
            context = self._build_memory_context(all_memories)
            
            summary_prompt = f"""
            Based on the following story memories, create a concise summary of the adventure so far:
            
            {context}
            
            Summary:
            """
            
            response = await self.llm.agenerate([[HumanMessage(content=summary_prompt)]])
            return response.generations[0][0].text
            
        except Exception as e:
            logger.error(f"Error generating story summary: {e}")
            return "Error generating summary."
    
    async def cleanup_chat_memories(self, chat_id: str) -> bool:
        """Clean up memories when a chat is deleted"""
        try:
            return await self.memory_manager.delete_chat_memories(chat_id)
        except Exception as e:
            logger.error(f"Error cleaning up memories: {e}")
            return False
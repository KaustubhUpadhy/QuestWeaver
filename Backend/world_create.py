from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_user_preferences():
    """Collect initial user preferences for the story"""
    print("=== Story Generator Setup ===")
    genre = input("Enter what genre(s) you want the story to be: ")
    character = input("Enter the character you want to play (name, role, lore, etc.): ")
    world_additions = input("Enter any extra world information (factions, locations, details): ")
    actions = input("Do you want possible actions given after each response? (yes/no): ")
    return genre, character, world_additions, actions

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

def main():
    print("Welcome to the Interactive Story Generator!")
    print("=" * 50)
    
    # Get user preferences
    genre, character, world_additions, actions = get_user_preferences()
    
    # Initialize conversation with system message
    messages = [
        {
            "role": "system", 
            "content": create_system_message(genre, character, world_additions, actions)
        },
        {
            "role": "user",
            "content": "Generate a random story and world for me."
        }
    ]
    
    # Generate initial story
    print("\n" + "=" * 50)
    print("GENERATING YOUR ADVENTURE...")
    print("=" * 50)
    
    initial_response = generate_initial_story(messages)
    print(f"\n{initial_response}")
    
    # Add the assistant's response to conversation history
    messages.append({"role": "assistant", "content": initial_response})
    
    # Main game loop
    print("\n" + "=" * 50)
    print("Your adventure begins! Type your actions below.")
    print("(Type 'quit', 'exit', or 'end' to stop the game)")
    print("=" * 50)
    
    while True:
        # Get user input
        user_action = input("\n> What do you do? ").strip()
        
        # Check for exit commands
        if user_action.lower() in ['quit', 'exit', 'end', 'stop']:
            print("\nThanks for playing! Your adventure ends here.")
            break
        
        # Skip empty inputs
        if not user_action:
            print("Please enter an action.")
            continue
        
        # Add user action to conversation
        messages.append({"role": "user", "content": user_action})
        
        # Generate response
        print("\n" + "-" * 30)
        response = continue_story(messages)
        print(f"\n{response}")
        
        # Add assistant response to conversation
        messages.append({"role": "assistant", "content": response})
        
        # Optional: Limit conversation history to prevent token overflow
        # Keep system message + last 10 exchanges (20 messages)
        if len(messages) > 21:
            # Keep system message and recent conversation
            messages = [messages[0]] + messages[-20:]

if __name__ == "__main__":
    main()
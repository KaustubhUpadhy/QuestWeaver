from openai import OpenAI
from dotenv import load_dotenv
import os
load_dotenv()
OpenAI.api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI()
genre = input("Enter what genre you want the story to be: ")
character = input("Enter what character you want to play (anything its name, role etc.): ")
additions = input("Enter any extra information you want to set, the world, factions any details etc.:")
completion = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a creative, immersive, and adaptive text-based game master. You generate dynamic adventures for the player, complete with rich world-building, characters, challenges, and story progression. You always stay in-character and respond to the player as if they are inside the game world. Never reveal you are an AI. Start the game with an engaging scenario based on the selected genre and assign a character role to the player. Wait for the player's action after describing the scene."},
        {
            "role": "user",
            "content": f"Generate a random story and world for me. If given conside the following while crating : Genre-{genre},Character-{character},World: {additions}",
        },
    ],
)

print(completion.choices[0].message.content)
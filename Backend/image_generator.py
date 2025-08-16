import os
import requests
import boto3
import re
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
from typing import Tuple, Optional, Dict
import logging

load_dotenv()
logger = logging.getLogger(__name__)

#Class for Handling image generation and S3 storage for avatar and world images attached to the chats
class ImageGenerator:
    
    def __init__(self):
        # Hugging Face setup
        self.hf_token = os.getenv("HF_TOKEN")
        self.model_id = "stabilityai/stable-diffusion-xl-base-1.0"
        self.api_url = f"https://api-inference.huggingface.co/models/{self.model_id}"
        
        # AWS S3 setup
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )
        self.bucket = os.getenv("S3_BUCKET", "questweaver-assets")
        
        # Headers for HF API
        self.headers = {
            "Authorization": f"Bearer {self.hf_token}",
            "Accept": "image/png"
        }
    # Extracts world description from story content for world image generation
    def extract_world_content(self, story_content: str) -> str:
        try:
            # Find the world section - typically after **World:** and before **Character:**
            world_match = re.search(r'\*\*World:\s*([^*]+?)(?=\*\*Character:|$)', story_content, re.DOTALL | re.IGNORECASE)
            if world_match:
                world_text = world_match.group(1).strip()
                return world_text
            
            # Extract first paragraph after title
            lines = story_content.split('\n')
            world_content = []
            skip_first_lines = True
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Skip title and other headers
                if line.startswith('**') and line.endswith('**'):
                    if 'character' in line.lower():
                        break
                    continue
                
                if skip_first_lines and (line.startswith('**') or len(line) < 20):
                    continue
                    
                skip_first_lines = False
                world_content.append(line)
                
            
                if len(' '.join(world_content)) > 200:
                    break
            
            return ' '.join(world_content)[:300]  
            
        except Exception as e:
            logger.error(f"Error extracting world content: {e}")
            return "fantasy world"
    
    # Extracts character related information from the story content, for character avatar creation for the story chat
    def extract_character_content(self, story_content: str) -> str:
        try:
            # Find the character section
            char_match = re.search(r'\*\*Character:\s*([^*]+?)(?=\*\*[^*]|What do you do\?|$)', story_content, re.DOTALL | re.IGNORECASE)
            if char_match:
                char_text = char_match.group(1).strip()
                return char_text
            
            lines = story_content.split('\n')
            for line in lines:
                line = line.strip().lower()
                if any(keyword in line for keyword in ['you are', 'you play', 'character', 'hero', 'protagonist']):
                    return line[:200]
            
            return "fantasy character"
            
        except Exception as e:
            logger.error(f"Error extracting character content: {e}")
            return "fantasy character"
    
    # Function to create an optimized prompt for Image Generation
    def create_image_prompt(self, content: str, image_type: str) -> str:
        base_style = "cinematic, highly detailed, fantasy art, digital painting"
        
        if image_type == "world":
            return f"landscape of {content}, {base_style}, wide shot, environmental concept art, no characters"
        elif image_type == "character":
            return f"portrait of {content}, {base_style}, character design, fantasy portrait, centered composition"
        
        return f"{content}, {base_style}"
    
    # Function to create Hugging Face API
    async def generate_image(self, prompt: str) -> Optional[bytes]:
        try:
            payload = {
                "inputs": prompt,
                "parameters": {
                    "num_inference_steps": 35,
                    "guidance_scale": 7.0,
                    "width": 1024,
                    "height": 1024
                }
            }
            
            response = requests.post(self.api_url, headers=self.headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"HF API error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            return None
    
    # For Creating Different size variants for the images
    def create_image_variants(self, image_bytes: bytes, image_type: str) -> Dict[str, Tuple[bytes, str]]:
        variants = {}
        
        try:
            original_image = Image.open(BytesIO(image_bytes))
            
            if image_type == "world":   # World image variants
                variants["master"] = (image_bytes, "image/png")  
                
                # Web version (1280 width)
                web_img = original_image.copy()
                web_img.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                web_buffer = BytesIO()
                web_img.save(web_buffer, format="WEBP", quality=85)
                variants["web"] = (web_buffer.getvalue(), "image/webp")
                
                # Thumbnail (640 width)
                thumb_img = original_image.copy()
                thumb_img.thumbnail((640, 640), Image.Resampling.LANCZOS)
                thumb_buffer = BytesIO()
                thumb_img.save(thumb_buffer, format="WEBP", quality=80)
                variants["thumb"] = (thumb_buffer.getvalue(), "image/webp")
                
            elif image_type == "character":
                # Character image variants
                master_buffer = BytesIO()
                original_image.save(master_buffer, format="WEBP", quality=95)
                variants["master"] = (master_buffer.getvalue(), "image/webp")
                
                # Web version (1024)
                web_img = original_image.copy()
                web_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                web_buffer = BytesIO()
                web_img.save(web_buffer, format="WEBP", quality=85)
                variants["web"] = (web_buffer.getvalue(), "image/webp")
                
                # Avatar (256, square crop)
                avatar_img = original_image.copy()
                width, height = avatar_img.size
                size = min(width, height)
                left = (width - size) // 2
                top = (height - size) // 2
                avatar_img = avatar_img.crop((left, top, left + size, top + size))
                avatar_img.thumbnail((256, 256), Image.Resampling.LANCZOS)
                avatar_buffer = BytesIO()
                avatar_img.save(avatar_buffer, format="WEBP", quality=80)
                variants["avatar"] = (avatar_buffer.getvalue(), "image/webp")
            
            return variants
            
        except Exception as e:
            logger.error(f"Error creating image variants: {e}")
            return {}
    
    # Generates S3 key for image storage
    def get_s3_key(self, user_id: str, chat_id: str, image_type: str, variant: str) -> str:
        if image_type == "world":
            if variant == "master":
                return f"users/{user_id}/chats/{chat_id}/world/master.png"
            elif variant == "web":
                return f"users/{user_id}/chats/{chat_id}/world/web/1280.webp"
            elif variant == "thumb":
                return f"users/{user_id}/chats/{chat_id}/world/thumb/640.webp"
        
        elif image_type == "character":
            if variant == "master":
                return f"users/{user_id}/chats/{chat_id}/character/master.webp"
            elif variant == "web":
                return f"users/{user_id}/chats/{chat_id}/character/web/1024.webp"
            elif variant == "avatar":
                return f"users/{user_id}/chats/{chat_id}/character/avatar/256.webp"
        
        return f"users/{user_id}/chats/{chat_id}/{image_type}/{variant}"
    
    # Uploads images to S3
    async def upload_to_s3(self, image_bytes: bytes, s3_key: str, content_type: str) -> bool:
        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=image_bytes,
                ContentType=content_type,
                CacheControl="private, max-age=0, no-store"
            )
            return True
        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            return False
    
    # Function to handle the entire process for generating and storing images 
    async def generate_and_store_images(self, user_id: str, chat_id: str, story_content: str) -> Dict[str, bool]:
        results = {"world": False, "character": False}
        
        # Extract content for image
        world_content = self.extract_world_content(story_content)
        character_content = self.extract_character_content(story_content)
        
        # Generate world image
        try:
            world_prompt = self.create_image_prompt(world_content, "world")
            world_image_bytes = await self.generate_image(world_prompt)
            
            if world_image_bytes:
                world_variants = self.create_image_variants(world_image_bytes, "world")
                
                # Upload all world images
                world_success = True
                for variant, (img_bytes, content_type) in world_variants.items():
                    s3_key = self.get_s3_key(user_id, chat_id, "world", variant)
                    upload_success = await self.upload_to_s3(img_bytes, s3_key, content_type)
                    if not upload_success:
                        world_success = False
                        break
                
                results["world"] = world_success
            
        except Exception as e:
            logger.error(f"Error processing world image: {e}")
        
        # Generate character image
        try:
            character_prompt = self.create_image_prompt(character_content, "character")
            character_image_bytes = await self.generate_image(character_prompt)
            
            if character_image_bytes:
                character_variants = self.create_image_variants(character_image_bytes, "character")
                
                # Upload all character images
                character_success = True
                for variant, (img_bytes, content_type) in character_variants.items():
                    s3_key = self.get_s3_key(user_id, chat_id, "character", variant)
                    upload_success = await self.upload_to_s3(img_bytes, s3_key, content_type)
                    if not upload_success:
                        character_success = False
                        break
                
                results["character"] = character_success
            
        except Exception as e:
            logger.error(f"Error processing character image: {e}")
        
        return results
    
    # Generate presigned url for storage in Supabase and Frontend
    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> Optional[str]:
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': s3_key},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None
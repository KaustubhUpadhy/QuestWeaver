import chromadb
from chromadb.api import ClientAPI
from chromadb.api.models.Collection import Collection
from fastapi import Depends
from dotenv import load_dotenv
import os
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma

from langchain.schema import Document
from typing import List, Dict, Any, Optional
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Global clients
_client: ClientAPI | None = None
_collection: Collection | None = None
_vectorstore: Chroma | None = None
_embeddings: OpenAIEmbeddings | None = None

def get_chroma_client() -> ClientAPI:
    """Get or create ChromaDB client - CLOUD ONLY with proper configuration"""
    global _client
    if _client is None:
        # Require cloud credentials
        chroma_api_key = os.getenv("CHROMA_API_KEY")
        chroma_tenant = os.getenv("CHROMA_TENANT") 
        chroma_database = os.getenv("CHROMA_DATABASE")
        
        if not all([chroma_api_key, chroma_tenant, chroma_database]):
            missing = []
            if not chroma_api_key: missing.append("CHROMA_API_KEY")
            if not chroma_tenant: missing.append("CHROMA_TENANT") 
            if not chroma_database: missing.append("CHROMA_DATABASE")
            
            raise Exception(f"Missing ChromaDB Cloud credentials: {', '.join(missing)}")
        
        try:
            logger.info(f"Connecting to Chroma Cloud with tenant: {chroma_tenant}")
            
            # FIXED: Use proper ChromaDB Cloud client with correct settings
            settings = chromadb.config.Settings(
                chroma_api_impl="chromadb.api.fastapi.FastAPI",
                chroma_server_host="api.trychroma.com",
                chroma_server_http_port=443,
                chroma_server_ssl_enabled=True,
                chroma_server_grpc_port=None,
                chroma_api_key=chroma_api_key,
                anonymized_telemetry=False
            )
            
            _client = chromadb.CloudClient(
                tenant=chroma_tenant,
                database=chroma_database,
                settings=settings
            )
            
            # Test the connection by trying to list collections
            collections = _client.list_collections()
            logger.info(f"✅ Successfully connected to Chroma Cloud! Found {len(collections)} collections")
            return _client
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Chroma Cloud: {e}")
            logger.error(f"API Key present: {bool(chroma_api_key)}")
            logger.error(f"Tenant: {chroma_tenant}")
            logger.error(f"Database: {chroma_database}")
            
            # Check if it's a tenant issue and provide helpful error
            if "tenant" in str(e).lower() or "does not exist" in str(e).lower():
                raise Exception(f"ChromaDB tenant '{chroma_tenant}' not found. Please verify your tenant ID in the ChromaDB dashboard.")
            elif "api" in str(e).lower() and "deprecated" in str(e).lower():
                raise Exception("ChromaDB API version issue. Please check if your ChromaDB plan is active and tenant exists.")
            else:
                raise Exception(f"ChromaDB Cloud connection failed: {e}")
    
    return _client

def get_chroma_collection(client: ClientAPI = Depends(get_chroma_client)) -> Collection:
    """Get or create ChromaDB collection for quest memories"""
    global _collection
    if _collection is None:
        try:
            _collection = client.get_or_create_collection(
                name="quest_memories",
                metadata={"description": "Story memories and world events for QuestWeaver AI"}
            )
            logger.info("✅ Connected to quest_memories collection")
        except Exception as e:
            logger.error(f"❌ Failed to get/create collection: {e}")
            raise Exception(f"Failed to initialize ChromaDB collection: {e}")
    return _collection

def get_embeddings() -> OpenAIEmbeddings:
    """Get OpenAI embeddings instance"""
    global _embeddings
    if _embeddings is None:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise Exception("OPENAI_API_KEY environment variable is required")
            
        _embeddings = OpenAIEmbeddings(
            openai_api_key=openai_api_key,
            model="text-embedding-ada-002"
        )
        logger.info("✅ Initialized OpenAI embeddings (text-embedding-ada-002)")
    return _embeddings

def get_vectorstore(
    client: ClientAPI = Depends(get_chroma_client),
    embeddings: OpenAIEmbeddings = Depends(get_embeddings)
) -> Chroma:
    """Get LangChain Chroma vectorstore instance with OpenAI embeddings"""
    global _vectorstore
    if _vectorstore is None:
        try:
            _vectorstore = Chroma(
                client=client,
                collection_name="quest_memories",
                embedding_function=embeddings
            )
            logger.info("✅ Initialized LangChain Chroma vectorstore with OpenAI embeddings")
        except Exception as e:
            logger.error(f"❌ Failed to initialize vectorstore: {e}")
            raise Exception(f"Failed to initialize vectorstore: {e}")
    return _vectorstore

class MemoryManager:
    """Manages story memories with semantic search capabilities"""
    
    def __init__(self, vectorstore: Chroma, collection: Collection):
        self.vectorstore = vectorstore
        self.collection = collection
    
    async def store_memory(
        self, 
        content: str, 
        user_id: str, 
        chat_id: str, 
        role: str,
        memory_type: str = "general",
        additional_metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Store a memory with metadata for filtering"""
        try:
            # Create metadata
            metadata = {
                "user_id": user_id,
                "chat_id": chat_id,
                "role": role,
                "memory_type": memory_type,
                "timestamp": str(int(time.time())),
                **(additional_metadata or {})
            }
            
            # Generate unique ID
            memory_id = f"{chat_id}_{role}_{int(time.time())}"
            
            # Store in vectorstore (LangChain will handle embeddings)
            self.vectorstore.add_texts(
                texts=[content],
                metadatas=[metadata],
                ids=[memory_id]
            )
            
            logger.info(f"✅ Stored memory {memory_id} for user {user_id}")
            return memory_id
            
        except Exception as e:
            logger.error(f"❌ Failed to store memory: {e}")
            raise Exception(f"Failed to store memory: {e}")
    
    async def retrieve_memories(
        self,
        query: str,
        user_id: str,
        chat_id: str,
        k: int = 5,
        memory_types: Optional[List[str]] = None,
        include_roles: Optional[List[str]] = None
    ) -> List[Document]:
        """Retrieve relevant memories with filtering"""
        try:
            # Get ALL memories without any where filter first (to avoid ChromaDB bugs)
            docs = self.vectorstore.similarity_search(
                query=query,
                k=k * 10  # Get many more to filter manually
            )
            
            # Manually filter the results
            filtered_docs = []
            for doc in docs:
                metadata = doc.metadata
                
                # Must match user_id and chat_id
                if (metadata.get("user_id") != user_id or 
                    metadata.get("chat_id") != chat_id):
                    continue
                
                # Filter by memory types if specified
                if memory_types and metadata.get("memory_type") not in memory_types:
                    continue
                    
                # Filter by roles if specified
                if include_roles and metadata.get("role") not in include_roles:
                    continue
                    
                filtered_docs.append(doc)
                
                # Stop when we have enough
                if len(filtered_docs) >= k:
                    break
            
            logger.info(f"✅ Retrieved {len(filtered_docs)} memories for query: {query[:50]}...")
            return filtered_docs
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve memories: {e}")
            return []
    
    async def get_recent_memories(
        self,
        user_id: str,
        chat_id: str,
        limit: int = 10
    ) -> List[Document]:
        """Get most recent memories from a chat"""
        try:
            # Use simple similarity search to avoid where clause issues
            docs = self.vectorstore.similarity_search(
                query="recent conversation",
                k=limit * 3  # Get more to filter manually
            )
            
            # Filter manually
            filtered_docs = []
            for doc in docs:
                metadata = doc.metadata
                if (metadata.get("user_id") == user_id and 
                    metadata.get("chat_id") == chat_id):
                    filtered_docs.append(doc)
                if len(filtered_docs) >= limit:
                    break
            
            logger.info(f"✅ Retrieved {len(filtered_docs)} recent memories for chat {chat_id}")
            return filtered_docs
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent memories: {e}")
            return []
    
    async def delete_chat_memories(self, chat_id: str) -> bool:
        """Delete all memories for a specific chat"""
        try:
            # Simple delete with where clause
            self.collection.delete(
                where={"chat_id": {"$eq": chat_id}}
            )
            logger.info(f"✅ Deleted memories for chat {chat_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete chat memories: {e}")
            return False

def get_memory_manager(
    vectorstore: Chroma = Depends(get_vectorstore),
    collection: Collection = Depends(get_chroma_collection)
) -> MemoryManager:
    """Dependency injection for MemoryManager"""
    return MemoryManager(vectorstore, collection)
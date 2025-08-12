import chromadb
from chromadb.api import ClientAPI
from chromadb.api.models.Collection import Collection
from fastapi import Depends
from dotenv import load_dotenv
import os
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document
from typing import List, Dict, Any, Optional
import logging
import time
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Global clients
_client: ClientAPI | None = None
_collection: Collection | None = None
_embeddings: OpenAIEmbeddings | None = None

def get_chroma_client() -> ClientAPI:
    """Get or create ChromaDB client - Direct ChromaDB 1.0.16 connection"""
    global _client
    if _client is None:
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
            
            # Use exact format from ChromaDB dashboard
            _client = chromadb.HttpClient(
                ssl=True,
                host='api.trychroma.com',
                tenant=chroma_tenant,
                database=chroma_database,
                headers={
                    'x-chroma-token': chroma_api_key
                }
            )
            
            # Test the connection
            collections = _client.list_collections()
            logger.info(f"✅ Successfully connected to Chroma Cloud! Found {len(collections)} collections")
            return _client
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Chroma Cloud: {e}")
            logger.error(f"API Key present: {bool(chroma_api_key)}")
            logger.error(f"Tenant: {chroma_tenant}")
            logger.error(f"Database: {chroma_database}")
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

class DirectChromaMemoryManager:
    """Direct ChromaDB integration without LangChain-Chroma"""
    
    def __init__(self, collection: Collection, embeddings: OpenAIEmbeddings):
        self.collection = collection
        self.embeddings = embeddings
    
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
            
            # Generate embeddings using OpenAI
            embedding = self.embeddings.embed_query(content)
            
            # Store directly in ChromaDB
            self.collection.add(
                documents=[content],
                embeddings=[embedding],
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
            # Generate query embedding
            query_embedding = self.embeddings.embed_query(query)
            
            # Build where clause for filtering
            where_clause = {
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"chat_id": {"$eq": chat_id}}
                ]
            }
            
            if memory_types:
                where_clause["$and"].append({"memory_type": {"$in": memory_types}})
            
            if include_roles:
                where_clause["$and"].append({"role": {"$in": include_roles}})
            
            # Query ChromaDB directly
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                where=where_clause,
                include=["documents", "metadatas", "distances"]
            )
            
            # Convert to LangChain Documents
            documents = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    documents.append(Document(page_content=doc, metadata=metadata))
            
            logger.info(f"✅ Retrieved {len(documents)} memories for query: {query[:50]}...")
            return documents
            
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
            # Get recent memories by timestamp
            where_clause = {
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"chat_id": {"$eq": chat_id}}
                ]
            }
            
            # Get more than needed to sort by timestamp
            results = self.collection.get(
                where=where_clause,
                limit=limit * 2,
                include=["documents", "metadatas"]
            )
            
            # Convert and sort by timestamp
            documents = []
            if results['documents']:
                doc_data = list(zip(results['documents'], results['metadatas']))
                # Sort by timestamp (most recent first)
                doc_data.sort(key=lambda x: int(x[1].get('timestamp', 0)), reverse=True)
                
                for doc, metadata in doc_data[:limit]:
                    documents.append(Document(page_content=doc, metadata=metadata))
            
            logger.info(f"✅ Retrieved {len(documents)} recent memories for chat {chat_id}")
            return documents
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent memories: {e}")
            return []
    
    async def delete_chat_memories(self, chat_id: str) -> bool:
        """Delete all memories for a specific chat"""
        try:
            self.collection.delete(
                where={"chat_id": {"$eq": chat_id}}
            )
            logger.info(f"✅ Deleted memories for chat {chat_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete chat memories: {e}")
            return False

MemoryManager = DirectChromaMemoryManager

def get_memory_manager(
    collection: Collection = Depends(get_chroma_collection),
    embeddings: OpenAIEmbeddings = Depends(get_embeddings)
) -> DirectChromaMemoryManager:
    """Dependency injection for MemoryManager"""
    return DirectChromaMemoryManager(collection, embeddings)
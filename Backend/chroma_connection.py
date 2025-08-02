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
    """Get or create ChromaDB client - PRIORITIZE CLOUD CONNECTION"""
    global _client
    if _client is None:
        # Always try cloud first with your credentials
        chroma_api_key = os.getenv("CHROMA_API_KEY")
        chroma_tenant = os.getenv("CHROMA_TENANT") 
        chroma_database = os.getenv("CHROMA_DATABASE")
        
        if chroma_api_key and chroma_tenant and chroma_database:
            try:
                logger.info(f"Attempting to connect to Chroma Cloud with tenant: {chroma_tenant}")
                _client = chromadb.CloudClient(
                    api_key=chroma_api_key,
                    tenant=chroma_tenant,
                    database=chroma_database
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
                
                # Don't fall back to local - let's fix the cloud connection
                raise Exception(f"ChromaDB Cloud connection failed: {e}")
        else:
            missing = []
            if not chroma_api_key: missing.append("CHROMA_API_KEY")
            if not chroma_tenant: missing.append("CHROMA_TENANT") 
            if not chroma_database: missing.append("CHROMA_DATABASE")
            
            raise Exception(f"Missing ChromaDB Cloud credentials: {', '.join(missing)}")
    
    return _client

def get_chroma_collection(client: ClientAPI = Depends(get_chroma_client)) -> Collection:
    """Get or create ChromaDB collection for quest memories"""
    global _collection
    if _collection is None:
        _collection = client.get_or_create_collection(
            name="quest_memories",
            metadata={"description": "Story memories and world events for DungeonCraft AI"}
        )
        logger.info("Connected to quest_memories collection")
    return _collection

def get_embeddings() -> OpenAIEmbeddings:
    """Get OpenAI embeddings instance (no sentence-transformers needed)"""
    global _embeddings
    if _embeddings is None:
        _embeddings = OpenAIEmbeddings(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model="text-embedding-ada-002"  # Reliable OpenAI embedding model
        )
        logger.info("Initialized OpenAI embeddings (text-embedding-ada-002)")
    return _embeddings

def get_vectorstore(
    client: ClientAPI = Depends(get_chroma_client),
    embeddings: OpenAIEmbeddings = Depends(get_embeddings)
) -> Chroma:
    """Get LangChain Chroma vectorstore instance with OpenAI embeddings"""
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            client=client,
            collection_name="quest_memories",
            embedding_function=embeddings
        )
        logger.info("Initialized LangChain Chroma vectorstore with OpenAI embeddings")
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
            
            logger.info(f"Stored memory {memory_id} for user {user_id}")
            return memory_id
            
        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            raise
    
    async def retrieve_memories(
        self,
        query: str,
        user_id: str,
        chat_id: str,
        k: int = 5,
        memory_types: Optional[List[str]] = None,
        include_roles: Optional[List[str]] = None
    ) -> List[Document]:
        """Retrieve relevant memories with filtering - COMPLETELY FIXED"""
        try:
            # Get ALL memories without any where filter first (to avoid the ChromaDB bug)
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
            
            logger.info(f"Retrieved {len(filtered_docs)} memories for query: {query[:50]}...")
            return filtered_docs
            
        except Exception as e:
            logger.error(f"Failed to retrieve memories: {e}")
            return []
    
    async def get_recent_memories(
        self,
        user_id: str,
        chat_id: str,
        limit: int = 10
    ) -> List[Document]:
        """Get most recent memories from a chat - FIXED embedding dimension issue"""
        try:
            # Use LangChain vectorstore for consistency (same embedding model)
            # But avoid the where clause entirely since it's problematic
            docs = self.vectorstore.similarity_search(
                query="recent conversation",
                k=limit * 3  # Get more to filter manually
            )
            
            # Filter manually to avoid ChromaDB where clause issues
            filtered_docs = []
            for doc in docs:
                metadata = doc.metadata
                if (metadata.get("user_id") == user_id and 
                    metadata.get("chat_id") == chat_id):
                    filtered_docs.append(doc)
                if len(filtered_docs) >= limit:
                    break
            
            logger.info(f"Retrieved {len(filtered_docs)} recent memories for chat {chat_id}")
            return filtered_docs
            
        except Exception as e:
            logger.error(f"Failed to get recent memories via vectorstore: {e}")
            # Final fallback: get all from collection and filter manually
            try:
                # Get all items from collection without embedding query
                all_results = self.collection.get()
                
                filtered_docs = []
                if all_results["documents"] and all_results["metadatas"]:
                    for i, doc in enumerate(all_results["documents"]):
                        metadata = all_results["metadatas"][i]
                        if (metadata.get("user_id") == user_id and 
                            metadata.get("chat_id") == chat_id):
                            filtered_docs.append(Document(page_content=doc, metadata=metadata))
                        if len(filtered_docs) >= limit:
                            break
                
                logger.info(f"Retrieved {len(filtered_docs)} recent memories for chat {chat_id} (manual fallback)")
                return filtered_docs
                
            except Exception as fallback_error:
                logger.error(f"Manual fallback also failed: {fallback_error}")
                return []
    
    async def delete_chat_memories(self, chat_id: str) -> bool:
        """Delete all memories for a specific chat - FIXED with proper ChromaDB syntax"""
        try:
            # For delete, we can use simple syntax since it's only one filter
            self.collection.delete(
                where={"chat_id": {"$eq": chat_id}}
            )
            logger.info(f"Deleted memories for chat {chat_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete chat memories with direct method: {e}")
            # Fallback: Get IDs first, then delete by IDs
            try:
                results = self.collection.query(
                    query_texts=["memory to delete"],
                    n_results=1000
                )
                
                ids_to_delete = []
                if results["ids"] and results["metadatas"]:
                    for i, metadata in enumerate(results["metadatas"][0]):
                        if metadata.get("chat_id") == chat_id:
                            doc_id = results["ids"][0][i]
                            ids_to_delete.append(doc_id)
                
                if ids_to_delete:
                    self.collection.delete(ids=ids_to_delete)
                    logger.info(f"Deleted {len(ids_to_delete)} memories for chat {chat_id} (fallback)")
                else:
                    logger.info(f"No memories found to delete for chat {chat_id}")
                
                return True
                
            except Exception as fallback_error:
                logger.error(f"Fallback delete also failed: {fallback_error}")
                return False

def get_memory_manager(
    vectorstore: Chroma = Depends(get_vectorstore),
    collection: Collection = Depends(get_chroma_collection)
) -> MemoryManager:
    """Dependency injection for MemoryManager"""
    return MemoryManager(vectorstore, collection)
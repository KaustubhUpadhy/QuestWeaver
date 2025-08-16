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
from functools import lru_cache

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


@lru_cache() #ChromaDB client, chached for reuse
def create_chroma_client() -> ClientAPI:
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
        logger.info(f"Connecting to Chroma Cloud with tenant")
        
        client = chromadb.HttpClient(
            ssl=True,
            host='api.trychroma.com',
            tenant=chroma_tenant,
            database=chroma_database,
            headers={
                'x-chroma-token': chroma_api_key
            }
        )
        
        # Testing the connection
        collections = client.list_collections()
        logger.info(f"Successfully connected to Chroma Cloud! Found {len(collections)} collections")
        return client
        
    except Exception as e:
        logger.error(f"Failed to connect to Chroma Cloud: {e}")
        raise Exception(f"ChromaDB Cloud connection failed: {e}")

def get_chroma_client() -> ClientAPI: #gets the ChromaDB client
    return create_chroma_client()

#Gets the existing ChromaDB collections or Creates one if it doesn't exists
def get_chroma_collection(client: ClientAPI = Depends(get_chroma_client)) -> Collection:
    try:
        collection = client.get_or_create_collection(
            name="quest_memories",
            metadata={"description": "Story memories and world events for QuestWeaver AI"}
        )
        logger.info("Connected to quest_memories collection")
        return collection
    except Exception as e:
        logger.error(f"Failed to get/create collection: {e}")
        raise Exception(f"Failed to initialize ChromaDB collection: {e}")

@lru_cache() #Creates OpenAI embeddings instance, Cached for reuse
def create_embeddings() -> OpenAIEmbeddings:
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise Exception("OPENAI_API_KEY environment variable is required")
        
    embeddings = OpenAIEmbeddings(
        openai_api_key=openai_api_key,
        model="text-embedding-ada-002"
    )
    logger.info("Initialized OpenAI embeddings")
    return embeddings

def get_embeddings() -> OpenAIEmbeddings: #getter function for OpenAI embeddings isntance
    return create_embeddings()

# Integrates ChromaDB
class DirectChromaMemoryManager:
   
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
        #Stores the memory with metadata for filtering
        try:
            metadata = {
                "user_id": user_id,
                "chat_id": chat_id,
                "role": role,
                "memory_type": memory_type,
                "timestamp": str(int(time.time())),
                **(additional_metadata or {})
            }
            
            # Generates unique ID
            memory_id = f"{chat_id}_{role}_{int(time.time())}"
            
            # Generates embeddings using OpenAI
            embedding = self.embeddings.embed_query(content)
            
            # Stored directly in ChromaDB
            self.collection.add(
                documents=[content],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[memory_id]
            )
            
            logger.info(f"Stored memory {memory_id} for user {user_id}")
            return memory_id
            
        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
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
        # For retrieveing user memories with filtering
        try:
            # Generates query embedding
            query_embedding = self.embeddings.embed_query(query)
            
            # Creates where clause for filtering
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
            
            # Query ChromaDB 
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                where=where_clause,
                include=["documents", "metadatas", "distances"]
            )
            
            # Converts them to LangChain Documents
            documents = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    documents.append(Document(page_content=doc, metadata=metadata))
            
            logger.info(f"Retrieved {len(documents)} memories for query: {query[:50]}...")
            return documents
            
        except Exception as e:
            logger.error(f"Failed to retrieve memories: {e}")
            return []
    
    async def get_recent_memories(
        self,
        user_id: str,
        chat_id: str,
        limit: int = 10
    ) -> List[Document]:
        try:
            # Get recent memories by timestamp
            where_clause = {
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"chat_id": {"$eq": chat_id}}
                ]
            }
            
            results = self.collection.get(
                where=where_clause,
                limit=limit * 2,
                include=["documents", "metadatas"]
            )
            
            # Convert the memories and sort by timestamp for easier Frontend Integration
            documents = []
            if results['documents']:
                doc_data = list(zip(results['documents'], results['metadatas']))
                doc_data.sort(key=lambda x: int(x[1].get('timestamp', 0)), reverse=True)
                
                for doc, metadata in doc_data[:limit]:
                    documents.append(Document(page_content=doc, metadata=metadata))
            
            logger.info(f"Retrieved {len(documents)} recent memories for chat {chat_id}")
            return documents
            
        except Exception as e:
            logger.error(f"Failed to get recent memories: {e}")
            return []
    
    # Function to Delete all memories for a specific user
    async def delete_chat_memories(self, chat_id: str) -> bool:
        try:
            self.collection.delete(
                where={"chat_id": {"$eq": chat_id}}
            )
            logger.info(f"Deleted memories for chat {chat_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete chat memories: {e}")
            return False

MemoryManager = DirectChromaMemoryManager

def get_memory_manager(
    collection: Collection = Depends(get_chroma_collection),
    embeddings: OpenAIEmbeddings = Depends(get_embeddings)
) -> DirectChromaMemoryManager:
    return DirectChromaMemoryManager(collection, embeddings)
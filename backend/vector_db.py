from qdrant_client import QdrantClient, models
import os

# --- SMART CONNECTION LOGIC ---
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

print(f"DEBUG: Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

def init_collections():
    """Create collections if they don't exist"""
    # 1. Collection for Resumes
    if not client.collection_exists("resumes"):
        client.create_collection(
            collection_name="resumes",
            vectors_config=models.VectorParams(size=768, distance=models.Distance.COSINE),
        )

    # 2. Collection for Jobs (Optional)
    if not client.collection_exists("jobs"):
        client.create_collection(
            collection_name="jobs",
            vectors_config=models.VectorParams(size=768, distance=models.Distance.COSINE),
        )

def store_resume_vector(candidate_id: int, vector: list, metadata: dict):
    client.upsert(
        collection_name="resumes",
        points=[
            models.PointStruct(
                id=candidate_id,
                vector=vector,
                payload=metadata
            )
        ]
    )

def search_resumes_for_job(job_vector: list, limit: int = 5, batch_id: str = None):
    query_filter = None
    if batch_id:
        query_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="batch_id",
                    match=models.MatchValue(value=batch_id)
                )
            ]
        )

    results = client.query_points(
        collection_name="resumes",
        query=job_vector,
        limit=limit,
        query_filter=query_filter, 
        with_payload=True 
    )
    
    return results.points
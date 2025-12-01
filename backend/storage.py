import boto3
from botocore.client import Config
import os

# --- SMART CONNECTION LOGIC ---
# In Docker, this will be 'minio'. On localhost, it defaults to 'localhost'.
# MINIO_HOST = os.getenv("MINIO_HOST", "localhost")
ENDPOINT_URL = os.getenv("MINIO_ENDPOINT")


print(f"DEBUG: Connecting to MinIO at {ENDPOINT_URL}")

s3_client = boto3.client(
    "s3",
    endpoint_url=ENDPOINT_URL, 
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin",
    config=Config(signature_version="s3v4"),
    region_name="us-east-1"
)

BUCKET_NAME = "resumes-lake"

def init_bucket():
    """Create the bucket if it doesn't exist yet"""
    try:
        s3_client.create_bucket(Bucket=BUCKET_NAME)
        print(f"Bucket '{BUCKET_NAME}' ready.")
    except Exception as e:
        # If bucket exists, it might throw an error, which is fine
        print(f"Bucket check: {e}")

def upload_file_to_lake(file_obj, filename):
    """Uploads a file to MinIO and returns the path"""
    try:
        s3_client.upload_fileobj(file_obj, BUCKET_NAME, filename)
        return f"s3://{BUCKET_NAME}/{filename}"
    except Exception as e:
        print(f"Upload failed: {e}")
        return None
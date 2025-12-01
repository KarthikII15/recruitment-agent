import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file (for local dev)
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

# --- SMART CONNECTION LOGIC ---
# 1. Check if Docker/Cloud has provided a full URL
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. If not, build it manually for Local Development (localhost)
if not DATABASE_URL:
    print("DEBUG: No DATABASE_URL found. Using Localhost fallback.")
    
    # FIX: Added default values to prevent "None" or "admin" errors
    # Change 'postgres' and 'password' below to match your local setup if different
    user = os.getenv('POSTGRES_USER', 'postgres')
    password = os.getenv('POSTGRES_PASSWORD', 'password') 
    db_name = os.getenv('POSTGRES_DB', 'recruitment_db')
    host = os.getenv('POSTGRES_HOST', 'localhost')
    port = os.getenv('POSTGRES_PORT', '5432')
    
    DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{db_name}"
else:
    print("DEBUG: Using DATABASE_URL from Environment (Docker/Cloud)")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Helper function to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
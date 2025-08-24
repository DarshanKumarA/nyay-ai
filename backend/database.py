# backend/database.py

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Get the absolute path to the directory where this file is located.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Define the path for the single, main database file.
DATABASE_FILE_PATH = os.path.join(BACKEND_DIR, "nyay_ai_main.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_FILE_PATH}"

# Create the async engine. The connect_args are recommended for SQLite
# to ensure that the same connection is not shared across different threads.
engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create a session maker. This will be the factory for all new sessions.
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative class definitions (our models).
Base = declarative_base()

# --- Dependency to get a DB session ---
async def get_db():
    """
    A dependency that provides a database session for a single request.
    Ensures the session is always closed, even if errors occur.
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
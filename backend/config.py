# backend/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    """
    Manages application settings and environment variables.
    """
    # Core application settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # API Keys from the .env file
    GEMINI_API_KEY: str
    HF_API_TOKEN: Optional[str] = None # Making this optional as it's not used yet

    # Pydantic-settings configuration
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8')

# Create a single, importable instance of the settings
settings = Settings()
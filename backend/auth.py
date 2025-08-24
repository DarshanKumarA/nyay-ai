# backend/auth.py

import schemas
import crud
from database import SessionLocal

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt 
from datetime import datetime, timedelta, timezone

# --- UPDATED: Import the single settings object ---
from config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed one using bcrypt."""
    password_bytes = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_password_bytes)

def get_password_hash(password: str) -> str:
    """Hashes a plain password using bcrypt."""
    password_bytes = password.encode('utf-8')
    hashed_bytes = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed_bytes.decode('utf-8')

def create_access_token(data: dict):
    """Creates a new JWT access token."""
    to_encode = data.copy()
    # --- UPDATED: Use the settings object ---
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY not found in environment variables")
        
    # --- UPDATED: Use the settings object ---
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Decodes a JWT token and retrieves the user from the database."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # --- UPDATED: Use the settings object ---
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    async with SessionLocal() as db:
        user = await crud.get_user_by_username(db, username=token_data.username)
        if user is None:
            raise credentials_exception
        return user
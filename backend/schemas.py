# backend/schemas.py

from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class CaseFileBase(BaseModel):
    filename: str

class CaseFileCreate(CaseFileBase):
    pass

class CaseFile(CaseFileBase):
    id: int
    upload_date: datetime
    owner_id: int
    
    model_config = ConfigDict(from_attributes=True)

class FeedbackBase(BaseModel):
    query_case_filename: str
    precedent_case_filename: str
    is_relevant: bool

class FeedbackCreate(FeedbackBase):
    pass

class Feedback(FeedbackBase):
    id: int
    user_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class ContradictionBase(BaseModel):
    compared_files: str
    report: str

class ContradictionCreate(ContradictionBase):
    pass

class Contradiction(ContradictionBase):
    id: int
    user_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str
    full_name: str
    age: int

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class EntitySearchRequest(BaseModel):
    entity_text: str

# --- Schemas for Chatbot ---

class ChatMessage(BaseModel):
    role: str
    parts: List[Dict[str, str]]

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    question: str
    context: Optional[str] = None
    # --- NEW: Add the stream flag to the request model ---
    stream: bool = False

# --- UPDATED: ChatResponse can now handle navigation ---
class ChatResponse(BaseModel):
    response_type: str  # "answer" or "navigate"
    answer: str
    page: Optional[str] = None

class SummarizeResponse(BaseModel):
    filename: str
    summary_data: Dict[str, Any]
    entity_data: Dict[str, Any]

class SuggestedQuestionsResponse(BaseModel):
    questions: List[str]
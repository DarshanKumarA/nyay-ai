# backend/models.py

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    age = Column(Integer)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    case_files = relationship("CaseFile", back_populates="owner")
    feedbacks = relationship("Feedback", back_populates="user")
    # --- NEW: Add relationship to the new Contradiction model ---
    contradictions = relationship("Contradiction", back_populates="user")

class CaseFile(Base):
    __tablename__ = "case_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="case_files")

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    query_case_filename = Column(String, index=True)
    precedent_case_filename = Column(String, index=True)
    is_relevant = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="feedbacks")

# --- NEW: Database model to store contradiction analysis reports ---
class Contradiction(Base):
    __tablename__ = "contradictions"
    id = Column(Integer, primary_key=True, index=True)
    # Store the list of files that were compared
    compared_files = Column(String) 
    # Store the full report from the AI
    report = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="contradictions")

# backend/crud.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
import models
import schemas

async def get_user_by_username(db: AsyncSession, username: str):
    """
    Fetches a single user by username.
    """
    query = select(models.User).filter(models.User.username == username)
    result = await db.execute(query)
    return result.scalars().first()


async def create_user(db: AsyncSession, user: schemas.UserCreate, hashed_password: str):
    """
    Creates a new user in the database.
    """
    db_user = models.User(
        username=user.username,
        full_name=user.full_name,
        age=user.age,
        hashed_password=hashed_password
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def get_user_files(db: AsyncSession, user_id: int):
    """
    Fetches all case files for a specific user.
    """
    result = await db.execute(
        select(models.CaseFile)
        .filter(models.CaseFile.owner_id == user_id)
        .order_by(models.CaseFile.upload_date.desc())
    )
    return result.scalars().all()


async def create_user_case_file(db: AsyncSession, filename: str, user_id: int):
    """
    Creates a new case file record linked to a user.
    """
    db_case_file = models.CaseFile(filename=filename, owner_id=user_id)
    db.add(db_case_file)
    await db.commit()
    await db.refresh(db_case_file)
    return db_case_file


async def create_feedback(db: AsyncSession, feedback: schemas.FeedbackCreate, user_id: int):
    """
    Creates a new feedback record linked to a user.
    """
    db_feedback = models.Feedback(
        query_case_filename=feedback.query_case_filename,
        precedent_case_filename=feedback.precedent_case_filename,
        is_relevant=feedback.is_relevant,
        user_id=user_id
    )
    db.add(db_feedback)
    await db.commit()
    await db.refresh(db_feedback)
    return db_feedback


async def count_user_feedback(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(func.count(models.Feedback.id))
        .filter(models.Feedback.user_id == user_id)
    )
    return result.scalar_one()


async def update_user(db: AsyncSession, user: models.User, update_data: schemas.UserUpdate):
    """
    Updates a user's profile information.
    """
    db_user = await db.merge(user)

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    
    await db.commit()
    await db.refresh(db_user)
    return db_user

# --- NEW: Contradiction CRUD functions ---
async def create_contradiction(db: AsyncSession, contradiction: schemas.ContradictionCreate, user_id: int):
    """Saves a new contradiction report to the database."""
    db_contradiction = models.Contradiction(**contradiction.dict(), user_id=user_id)
    db.add(db_contradiction)
    await db.commit()
    await db.refresh(db_contradiction)
    return db_contradiction

async def count_user_contradictions(db: AsyncSession, user_id: int):
    """Counts the number of contradiction reports for a user."""
    result = await db.execute(
        select(func.count(models.Contradiction.id))
        .filter(models.Contradiction.user_id == user_id)
    )
    return result.scalar_one()

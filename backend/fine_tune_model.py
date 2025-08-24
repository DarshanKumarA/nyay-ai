# backend/fine_tune_model.py

import os
import sys
import io
import shutil
import asyncio
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader
import pypdf

# --- NEW: SQLAlchemy imports for async database access ---
from sqlalchemy.future import select
from database import SessionLocal, Base, engine
import models

# --- Path and Model Configuration ---
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DOCUMENTS_PATH = os.path.join(BACKEND_DIR, "case_documents")
BASE_MODEL_NAME = "all-MiniLM-L6-v2"

def get_document_text(filename: str) -> str:
    """Helper function to read text from a file."""
    filepath = os.path.join(DOCUMENTS_PATH, filename)
    if not os.path.exists(filepath):
        print(f"Warning: File not found at {filepath}")
        return ""
    
    with open(filepath, 'rb') as f:
        file_content = f.read()
    
    text = ""
    if filename.lower().endswith('.pdf'):
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
            for page in pdf_reader.pages:
                text += page.extract_text() or ""
        except Exception as e:
            print(f"Warning: Could not read PDF {filename}. Error: {e}")
            return ""
    elif filename.lower().endswith('.txt'):
        text = file_content.decode('utf-8', errors='ignore')
    return text

# --- UPDATED: Async function to load data via SQLAlchemy ---
async def load_feedback_data(user_id: int):
    """Loads feedback pairs from the main database using SQLAlchemy."""
    print(f"Attempting to load feedback data for user_id: {user_id} from the main database.")
    
    # Use our async session from database.py
    async with SessionLocal() as db:
        query = (
            select(
                models.Feedback.query_case_filename,
                models.Feedback.precedent_case_filename
            )
            .where(models.Feedback.user_id == user_id)
            .where(models.Feedback.is_relevant == True)
        )
        result = await db.execute(query)
        feedback_pairs = result.fetchall()

    print(f"Found {len(feedback_pairs)} relevant feedback entries for user {user_id}.")
    return feedback_pairs

def create_training_examples(feedback_pairs):
    """Creates training examples for the sentence-transformer model."""
    print("Creating training examples...")
    train_examples = []
    for query_file, precedent_file in feedback_pairs:
        query_text = get_document_text(query_file)
        precedent_text = get_document_text(precedent_file)
        
        if query_text and precedent_text:
            train_examples.append(InputExample(texts=[query_text, precedent_text], label=1.0))
    
    print(f"Successfully created {len(train_examples)} training examples.")
    return train_examples

# --- UPDATED: Main function is now async ---
async def main(user_id: int):
    """Main async function to run the fine-tuning process for a specific user."""
    feedback_data = await load_feedback_data(user_id)
    if not feedback_data:
        print("No relevant feedback data found for this user to train on. Exiting.")
        return

    train_examples = create_training_examples(feedback_data)
    if not train_examples:
        print("Could not create any valid training examples. Exiting.")
        return

    user_model_dir = os.path.join(BACKEND_DIR, "user_models", str(user_id))
    model_to_load = user_model_dir if os.path.exists(user_model_dir) else BASE_MODEL_NAME
    
    print(f"Loading model for fine-tuning: {model_to_load}")
    model = SentenceTransformer(model_to_load)

    train_loss = losses.CosineSimilarityLoss(model)
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)

    print(f"Starting model fine-tuning for user {user_id}... (This may take a while)")
    model.fit(train_objectives=[(train_dataloader, train_loss)],
              epochs=1,
              warmup_steps=10)
    
    temp_model_dir = user_model_dir + "_temp"
    
    print(f"Fine-tuning complete. Preparing to save new model.")
    
    if os.path.exists(temp_model_dir):
        print(f"Removing existing temporary directory: '{temp_model_dir}'")
        shutil.rmtree(temp_model_dir)

    os.makedirs(temp_model_dir)
    
    print(f"Saving new model to temporary location: '{temp_model_dir}'")
    model.save(temp_model_dir)
    
    del model
    
    if os.path.exists(user_model_dir):
        print(f"Removing old model directory: '{user_model_dir}'")
        shutil.rmtree(user_model_dir)
    
    print(f"Renaming temporary model directory to final location: '{user_model_dir}'")
    os.rename(temp_model_dir, user_model_dir)
    
    print("Process finished successfully.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            user_id_arg = int(sys.argv[1])
            # --- UPDATED: Use asyncio.run to execute the async main function ---
            asyncio.run(main(user_id_arg))
        except ValueError:
            print("Error: Please provide a valid integer for the user_id.")
    else:
        print("Error: Please provide a user_id as a command-line argument.")
        print("Usage: python fine_tune_model.py <user_id>")
# backend/main.py

# --- Core Imports ---
import os
import io
import json
import re 
import shutil
import subprocess
import sys
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any, AsyncGenerator
import asyncio

# --- Library Imports ---
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks, Body
# --- REVERTED: Removed StreamingResponse ---
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sentence_transformers import SentenceTransformer

# --- AI & DB Imports ---
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
import chromadb
from chromadb.utils import embedding_functions
import pypdf
from langchain.text_splitter import RecursiveCharacterTextSplitter

# --- Local Module Imports ---
import models, schemas, crud, auth
from config import settings
from database import engine as main_engine, Base, get_db

# --- Global Variables & Path Definitions ---
gemini_model = None
chat_model = None
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DOCUMENTS_PATH = os.path.join(BACKEND_DIR, "case_documents")
USER_CHROMA_PATH = os.path.join(BACKEND_DIR, "user_chroma_dbs")
BASE_MODEL_NAME = "all-MiniLM-L6-v2"

# --- Helper Functions ---

def get_user_collection(user_id: int):
    user_db_path = os.path.join(USER_CHROMA_PATH, f"user_{user_id}")
    embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=BASE_MODEL_NAME)
    client = chromadb.PersistentClient(path=user_db_path)
    return client.get_or_create_collection(name=f"precedents_user_{user_id}", embedding_function=embedding_function)

def get_user_specific_paths(user_id: int):
    user_model_dir = os.path.join(BACKEND_DIR, "user_models", str(user_id))
    return {"path": user_model_dir, "exists": os.path.exists(user_model_dir)}

def load_model_for_user(user_id: int) -> SentenceTransformer:
    user_paths = get_user_specific_paths(user_id)
    if user_paths["exists"]:
        print(f"Loading personalized model for user {user_id}.")
        model_path_to_load = user_paths["path"]
    else:
        print(f"No personalized model found for user {user_id}. Using base model.")
        model_path_to_load = BASE_MODEL_NAME
    print(f"Loading embedding model from: {model_path_to_load}")
    return SentenceTransformer(model_path_to_load)

async def read_upload_file_content(upload_file: UploadFile) -> bytes:
    """Asynchronously reads the content of an UploadFile."""
    return await upload_file.read()

def save_file_content(file_content: bytes, destination: str) -> None:
    """Saves bytes content to a destination file."""
    try:
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        with open(destination, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        print(f"Error saving file to {destination}: {e}")
        raise HTTPException(status_code=500, detail="Could not save file.")

def get_text_from_upload(file_content: bytes, content_type: Optional[str]) -> str:
    text = ""
    if content_type == 'application/pdf':
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
            for page in pdf_reader.pages:
                text += page.extract_text() or ""
        except Exception as e:
            print(f"Error reading PDF content: {e}")
            return ""
    elif content_type and 'text' in content_type:
        try:
            text = file_content.decode('utf-8')
        except UnicodeDecodeError:
            text = file_content.decode('latin-1')
    return text

def find_entity_in_text(full_text: str, entity: str) -> List[str]:
    sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s', full_text)
    found_sentences = []
    pattern = r'\b' + re.escape(entity) + r'\b'
    for sentence in sentences:
        if re.search(pattern, sentence, re.IGNORECASE):
            found_sentences.append(sentence.strip())
    return found_sentences

async def get_semantic_queries_from_gemini(text: str) -> List[str]:
    print("Generating semantic queries with Gemini...")
    prompt = f"""
    You are a legal research expert. Based on the following legal document text, generate a JSON object containing a single key "queries".
    This key should have a value of a JSON array of 3 to 5 alternative search queries.
    These queries should capture the core legal concepts, principles, and factual patterns of the text, rather than just repeating keywords.
    Focus on rephrasing the core dispute in different legal terms.

    **ORIGINAL TEXT:**
    ---
    {text}
    ---

    **IMPORTANT: Respond ONLY with the raw JSON object.**
    """
    try:
        response = await gemini_model.generate_content_async(prompt)
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        queries = data.get("queries", [])
        print(f"Generated {len(queries)} semantic queries.")
        return queries
    except Exception as e:
        print(f"Error generating semantic queries from Gemini: {e}")
        return []

def reciprocal_rank_fusion(search_results_lists: List[List[str]], k: int = 60) -> List[str]:
    print("Performing Reciprocal Rank Fusion...")
    fused_scores = {}
    for doc_list in search_results_lists:
        for rank, doc_id in enumerate(doc_list):
            if doc_id not in fused_scores:
                fused_scores[doc_id] = 0
            fused_scores[doc_id] += 1 / (k + rank + 1)
    reranked_results = sorted(fused_scores.keys(), key=lambda x: fused_scores[x], reverse=True)
    print(f"Fused {len(reranked_results)} unique documents.")
    return reranked_results

def add_document_to_vector_store(user_id: int, text: str, filename: str):
    if not text.strip():
        print(f"Skipping empty document: {filename}")
        return
    print(f"Processing and chunking document: {filename}")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200, length_function=len)
    chunks = text_splitter.split_text(text)
    chunk_ids = [f"{filename}-chunk-{i}" for i, _ in enumerate(chunks)]
    metadatas = [{"filename": filename} for _ in chunks]
    collection = get_user_collection(user_id)
    if not collection.get(ids=[chunk_ids[0]])['ids']:
        collection.add(documents=chunks, metadatas=metadatas, ids=chunk_ids)
        print(f"Added {len(chunks)} chunks for {filename} to the vector store.")
    else:
        print(f"Document {filename} already exists in the vector store. Skipping.")

def run_fine_tuning_script(user_id: int):
    script_path = os.path.join(BACKEND_DIR, "fine_tune_model.py")
    python_executable = sys.executable
    try:
        process = subprocess.Popen([python_executable, script_path, str(user_id)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate()
        if process.returncode == 0:
            print(f"--- Fine-Tuning for user_id: {user_id} Completed ---\n{stdout}")
        else:
            print(f"--- Fine-Tuning for user_id: {user_id} Failed ---\n{stderr}")
    except Exception as e:
        print(f"An error occurred while running fine-tuning for user {user_id}: {e}")

def generate_intelligent_brief(text: str) -> Dict[str, Any]:
    if not gemini_model:
        raise HTTPException(status_code=500, detail="Gemini API not configured.")
    prompt = f"""
    You are an expert legal analyst. Analyze the following document...
    **LEGAL DOCUMENT TEXT:**
    ---
    {text}
    ---
    **YOUR TASK:**
    Generate a JSON object with the following keys:
    - "one_sentence_summary": A single, concise sentence.
    - "detailed_summary": A comprehensive paragraph.
    - "key_arguments": A JSON array of strings for key legal arguments.
    - "involved_parties": A JSON array of strings for involved parties.
    **IMPORTANT: Respond ONLY with the raw JSON object.**
    """
    try:
        response = gemini_model.generate_content(prompt)
        json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_string)
    except Exception as e:
        if "429" in str(e):
            raise HTTPException(status_code=429, detail=f"API Quota Exceeded: {e}")
        raise HTTPException(status_code=500, detail="AI model returned an invalid format for intelligent brief.")

def generate_ner_analysis(text: str) -> Dict[str, Any]:
    if not gemini_model:
        raise HTTPException(status_code=500, detail="Gemini API not configured.")
    
    prompt = f"""
    You are an expert paralegal. Your task is to perform Named Entity Recognition (NER) on the following legal document.
    **LEGAL DOCUMENT TEXT:**
    ---
    {text}
    ---
    **YOUR TASK:**
    Extract the key entities from the text. Generate a JSON object with the following keys. Each key should correspond to a JSON array of unique strings found in the document.
    - "people": Names of individuals (e.g., "John Doe").
    - "dates": Specific dates (e.g., "July 5th, 2023").
    - "locations": Cities, states, or specific courts (e.g., "High Court of Delhi").
    - "organizations": Companies, firms, or government bodies (e.g., "U.P. State Agro Industries Corporation").
    - "laws_articles": Specific laws, sections, or articles cited (e.g., "Article 311 of the Constitution", "Section 12-AA of the Income Tax Act").
    **IMPORTANT: Respond ONLY with the raw JSON object, without any surrounding text or markdown formatting.**
    """
    try:
        response = gemini_model.generate_content(prompt)
        json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(json_string)
    except Exception as e:
        if "429" in str(e):
            raise HTTPException(status_code=429, detail=f"API Quota Exceeded during entity analysis.")
        print(f"[JSON PARSE ERROR - NER]: {e}")
        print(f"[RAW LLM RESPONSE]: {response.text if 'response' in locals() else 'No response'}")
        raise HTTPException(status_code=500, detail="The AI model returned a response in an unexpected format for NER.")

# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup...")
    global gemini_model, chat_model
    os.makedirs(DOCUMENTS_PATH, exist_ok=True)
    os.makedirs(USER_CHROMA_PATH, exist_ok=True)
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        chat_model = genai.GenerativeModel('gemini-1.5-flash')
        print("Gemini API configured successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to configure Gemini API: {e}")
    async with main_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Main SQL database tables created/verified.")
    yield
    print("Application shutdown.")

# --- FastAPI App & Middleware ---
app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- API ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "Nyay AI Backend is running!"}

# --- Auth Endpoints ---
@app.post("/signup", response_model=schemas.User)
async def signup(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    db_user = await crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    return await crud.create_user(db=db, user=user, hashed_password=hashed_password)

@app.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.User)
async def update_user_profile(
    update_data: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return await crud.update_user(db=db, user=current_user, update_data=update_data)

@app.post("/users/me/change-password")
async def change_password(
    password_data: schemas.PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not auth.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password")
    
    hashed_password = auth.get_password_hash(password_data.new_password)
    current_user.hashed_password = hashed_password
    db.add(current_user)
    await db.commit()
    return {"message": "Password changed successfully"}

# --- Dashboard Endpoints ---
@app.get("/users/me/files", response_model=List[schemas.CaseFile])
async def read_user_files(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    files = await crud.get_user_files(db=db, user_id=current_user.id)
    return files

@app.get("/users/me/stats")
async def read_user_stats(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    num_cases = len(await crud.get_user_files(db=db, user_id=current_user.id))
    num_feedback = await crud.count_user_feedback(db=db, user_id=current_user.id)
    num_contradictions = await crud.count_user_contradictions(db=db, user_id=current_user.id)
    return {"casesAnalyzed": num_cases, "precedentsFound": num_feedback, "contradictionsFlagged": num_contradictions}

# --- User & Admin Endpoints ---
@app.post("/users/me/retrain-model")
async def retrain_user_model(background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(run_fine_tuning_script, current_user.id)
    return {"message": "Your personalized model is being updated."}

# --- Feature Endpoints ---
@app.post("/summarize")
async def summarize_case(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    file_content = await read_upload_file_content(file)
    file_path = os.path.join(DOCUMENTS_PATH, file.filename)
    save_file_content(file_content, file_path)

    text = get_text_from_upload(file_content, file.content_type)
    if not text.strip() or len(text.strip()) < 100:
        raise HTTPException(status_code=400, detail="File content is too short.")
    
    summary_data = generate_intelligent_brief(text)
    entity_data = generate_ner_analysis(text)
    
    db_case_file = await crud.create_user_case_file(db=db, filename=file.filename, user_id=current_user.id)
    add_document_to_vector_store(current_user.id, text, file.filename)
    
    return {
        "filename": file.filename, 
        "summary_data": summary_data,
        "entity_data": entity_data,
        "case_file_id": db_case_file.id # --- NEW: Return case_file_id
    }
    
@app.post("/documents/{filename}/find-entity", response_model=List[str])
async def find_entity_in_document(
    filename: str, 
    request: schemas.EntitySearchRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    file_path = os.path.join(DOCUMENTS_PATH, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(file_path, "rb") as f:
            file_content = f.read()
        content_type = 'application/pdf' if filename.lower().endswith('.pdf') else 'text/plain'
        full_text = get_text_from_upload(file_content, content_type)
        if not full_text:
            return []
        contexts = find_entity_in_text(full_text, request.entity_text)
        return contexts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/find_precedents")
async def find_precedents_unified(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    
    # 1. Read file content ONCE and get text
    file_content = await read_upload_file_content(file)
    raw_text = get_text_from_upload(file_content, file.content_type)
    
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    # 2. Save the file and add it to the database/vector store
    file_path = os.path.join(DOCUMENTS_PATH, file.filename)
    save_file_content(file_content, file_path)
    db_case_file = await crud.create_user_case_file(db=db, filename=file.filename, user_id=current_user.id)
    add_document_to_vector_store(current_user.id, raw_text, file.filename)

    # 3. Perform Summarization and Entity Analysis (logic from /summarize)
    summary_data = generate_intelligent_brief(raw_text)
    entity_data = generate_ner_analysis(raw_text)

    # 4. Perform Precedent Search (existing logic)
    st_model = await run_in_threadpool(load_model_for_user, current_user.id)
    collection = get_user_collection(current_user.id)
    
    query_embedding = await run_in_threadpool(st_model.encode, raw_text)
    standard_results = collection.query(query_embeddings=[query_embedding.tolist()], n_results=10)
    standard_doc_list = [meta['filename'] for meta in standard_results.get('metadatas', [[]])[0]]
    
    semantic_queries = await get_semantic_queries_from_gemini(raw_text)
    if semantic_queries:
        semantic_embeddings = await run_in_threadpool(st_model.encode, semantic_queries)
        semantic_results = collection.query(query_embeddings=semantic_embeddings.tolist(), n_results=5)
        semantic_doc_list = [meta['filename'] for meta_list in semantic_results.get('metadatas', []) for meta in meta_list]
    else:
        semantic_doc_list = []
        
    fused_results = reciprocal_rank_fusion([standard_doc_list, semantic_doc_list])
    
    top_unique_filenames = []
    seen_filenames = set()
    for filename in fused_results:
        if filename not in seen_filenames and filename != file.filename:
            seen_filenames.add(filename)
            top_unique_filenames.append(filename)
            if len(top_unique_filenames) >= 3:
                break
    
    # 5. Generate Final AI Analysis on Precedents
    context = ""
    for filename in top_unique_filenames:
        precedent_path = os.path.join(DOCUMENTS_PATH, filename)
        if os.path.exists(precedent_path):
            with open(precedent_path, "r", encoding='utf-8', errors='ignore') as f:
                precedent_text = f.read()
            context += f"--- PRECEDENT CASE: {filename} ---\n{precedent_text}\n\n"
            
    if not context.strip():
        precedent_analysis_data = {
            "query_filename": file.filename, 
            "analysis": {"precedents": {}}, 
            "overall_relevance": "No relevant precedents were found in your personal database."
        }
    else:
        prompt = f"""
        You are a legal analyst. A primary case and several retrieved precedents are provided. Your task is to analyze the relevance of each precedent to the primary case.

        **PRIMARY CASE TEXT:**
        ---
        {raw_text}
        ---

        **RETRIEVED PRECEDENT TEXTS:**
        ---
        {context}
        ---

        **YOUR TASK:**
        Generate a JSON object with two keys: "precedent_analyses" and "overall_relevance".
        1. The "precedent_analyses" key must contain a JSON array.
        2. Each object in the array should correspond to ONE of the precedent cases provided, in the SAME ORDER.
        3. Each object must have keys for "facts", "holding", and "relevance".
        4. The "overall_relevance" key should be a string summarizing your final conclusion.
        
        **IMPORTANT: Respond ONLY with the raw JSON object.**
        """
        response = await gemini_model.generate_content_async(prompt)
        try:
            raw_analysis = json.loads(response.text.strip().replace("```json", "").replace("```", ""))
            
            analysis_list = raw_analysis.get("precedent_analyses", [])
            
            combined_precedents = {}
            for i, filename in enumerate(top_unique_filenames):
                if i < len(analysis_list):
                    combined_precedents[filename] = analysis_list[i]

            precedent_analysis_data = {
                "query_filename": file.filename,
                "analysis": {
                    "precedents": combined_precedents
                },
                "overall_relevance": raw_analysis.get("overall_relevance", "No summary provided.")
            }
        except (json.JSONDecodeError, IndexError) as e:
            print(f"Error processing AI response for precedent analysis: {e}")
            raise HTTPException(status_code=500, detail="AI model returned an invalid format for precedent analysis.")

    # 6. Return the combined payload
    return {
        "filename": file.filename,
        "summary_data": summary_data,
        "entity_data": entity_data,
        "precedent_data": precedent_analysis_data,
        "case_file_id": db_case_file.id # --- NEW: Return case_file_id
    }


@app.post("/analyze_contradictions")
async def analyze_contradictions(filenames: List[str] = Body(..., embed=True), db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not gemini_model:
        raise HTTPException(status_code=500, detail="Gemini API not configured.")
    if len(filenames) < 2:
        raise HTTPException(status_code=400, detail="At least two files must be selected for comparison.")
    all_entities_context = ""
    for filename in filenames:
        file_path = os.path.join(DOCUMENTS_PATH, filename)
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "rb") as f:
                content_type = 'application/pdf' if filename.lower().endswith('.pdf') else 'text/plain'
                file_content = f.read()
            text = get_text_from_upload(file_content, content_type)
            if not text.strip():
                continue
            entities = generate_ner_analysis(text)
            all_entities_context += f"--- ENTITIES FROM: {filename} ---\n{json.dumps(entities, indent=2)}\n\n"
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=f"Error analyzing '{filename}': {e.detail}")
        except Exception as e:
            print(f"Unexpected error processing file {filename}: {e}")
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred while processing {filename}.")
    if not all_entities_context.strip():
        raise HTTPException(status_code=400, detail="Could not extract any information from the selected files.")
    prompt = f"""
    You are a meticulous investigative analyst. Your sole task is to find direct, logical contradictions from the evidence provided. Do not state differences; only identify clear conflicts.

    **EVIDENCE (EXTRACTED ENTITIES):**
    {all_entities_context}
    **YOUR TASK:**
    1.  Focus on entities related to the same person, event, or subject across different documents.
    2.  Identify factual impossibilities. The most important contradiction is a person being in two different locations on the same date. Other examples include conflicting timelines or actions.
    3.  Generate a JSON object with a single key: "contradiction_report".
    4.  The value must be an array of strings. Each string must be a direct, undeniable contradiction.
    5.  If you find a clear contradiction, state it directly. Example: "CONFLICT: Rajesh Kumar is listed in Bengaluru on Oct 28, 2024 in 'witness_testimony_A.txt' but travel records in 'exhibit_B_records.txt' place him in Delhi on the same day."
    6.  If NO logical contradictions are found, the array MUST contain only one string: "No direct contradictions were found." Do not list mere differences.

    **IMPORTANT: Respond ONLY with the raw JSON object.**
    """
    try:
        response = gemini_model.generate_content(prompt)
        json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
        analysis_data = json.loads(json_string)
        report_items = analysis_data.get("contradiction_report", [])
        if report_items and report_items[0] != "No direct contradictions were found.":
            contradiction_to_save = schemas.ContradictionCreate(
                compared_files=", ".join(filenames),
                report="\n".join(report_items)
            )
            await crud.create_contradiction(db=db, contradiction=contradiction_to_save, user_id=current_user.id)
            print(f"Contradiction report saved for user {current_user.id}")
        return analysis_data
    except Exception as e:
        print(f"Error during Gemini API call for contradiction analysis: {e}")
        raise HTTPException(status_code=500, detail="The AI model returned an invalid format or an error occurred.")

@app.post("/feedback", response_model=schemas.Feedback)
async def handle_feedback(feedback: schemas.FeedbackCreate, db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return await crud.create_feedback(db=db, feedback=feedback, user_id=current_user.id)

@app.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_ai(request: schemas.ChatRequest, current_user: models.User = Depends(auth.get_current_user)):
    if not chat_model:
        raise HTTPException(status_code=500, detail="Chat model not initialized.")

    system_instruction = """
    You are Nyay AI, an expert legal assistant. Your primary goal is to determine the user's intent and respond in a specific JSON format.
    When providing answers, use Markdown formatting (like lists, bolding with **, italics with *) to improve readability.

    1. If the user's intent is to **"navigate"** to a feature, you MUST identify the correct page from the list below.
       Match the user's request (even with typos) to the closest feature.
       - User wants to summarize, get a brief, or an overview -> "page": "/summarize"
       - User wants to find precedents, similar cases, or historical cases -> "page": "/precedents"
       - User wants to analyze evidence, find contradictions, or see conflicts -> "page": "/evidence"
       - User wants to personalize, retrain, or update the AI -> "page": "/personalize"
       - User wants to see their dashboard or home page -> "page": "/"

       Your JSON response for navigation MUST be:
       {"response_type": "navigate", "page": "/path/to/page", "answer": "A helpful confirmation message."}
       Example: {"response_type": "navigate", "page": "/precedents", "answer": "Certainly, I'll take you to the Precedent Analysis page."}

    2. If the user's intent is to **"answer"** a general question or a question about the provided document context, provide a direct answer.
       Your JSON response for answering MUST be:
       {"response_type": "answer", "answer": "Your detailed answer goes here."}

    **IMPORTANT**: If the user's request is ambiguous or does not clearly match a navigation feature, you MUST default to the "answer" intent. Do not guess a page.
    Always respond with a single, raw JSON object and nothing else.
    """
    
    full_history = [
        {'role': 'user', 'parts': [{'text': system_instruction}]},
        {'role': 'model', 'parts': [{'text': '{"response_type": "answer", "answer": "Understood. I will act as an intelligent navigator and expert assistant, adhering to the specified JSON format and using Markdown for clarity."}'}]},
    ]
    full_history.extend([{'role': msg.role, 'parts': [part['text'] for part in msg.parts]} for msg in request.history])

    chat_session = chat_model.start_chat(history=full_history)

    full_prompt = request.question
    if request.context:
        full_prompt = f"""
        **DOCUMENT CONTEXT:**
        ---
        {request.context}
        ---
        **QUESTION:**
        {request.question}
        """
    
    try:
        response = await chat_session.send_message_async(full_prompt)
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        response_data = json.loads(cleaned_text)
        
        return schemas.ChatResponse(
            response_type=response_data.get("response_type", "answer"),
            answer=response_data.get("answer", "I'm sorry, I couldn't process that request."),
            page=response_data.get("page")
        )

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing AI's JSON response: {e}. Raw response: {response.text}")
        return schemas.ChatResponse(response_type="answer", answer=response.text)
    except Exception as e:
        print(f"Error during chat generation: {e}")
        raise HTTPException(status_code=500, detail="Failed to get a response from the AI.")


@app.post("/generate-suggested-questions", response_model=schemas.SuggestedQuestionsResponse)
async def generate_suggested_questions(
    request: schemas.SummarizeResponse,
    current_user: models.User = Depends(auth.get_current_user)
):
    prompt = f"""
    Based on the following summary of a legal document, generate a JSON object with a single key "questions".
    This key should have a value of a JSON array of 3 insightful follow-up questions a user might ask.
    The questions should be concise and directly related to the key entities and arguments mentioned.

    **SUMMARY:**
    {request.summary_data.get('detailed_summary', '')}

    **KEY ARGUMENTS:**
    {', '.join(request.summary_data.get('key_arguments', []))}

    **INVOLVED PARTIES:**
    {', '.join(request.summary_data.get('involved_parties', []))}

    **IMPORTANT: Respond ONLY with the raw JSON object.**   
    """
    try:
        response = await gemini_model.generate_content_async(prompt)
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        return schemas.SuggestedQuestionsResponse(questions=data.get("questions", []))
    except Exception as e:
        print(f"Error generating suggested questions: {e}")
        return schemas.SuggestedQuestionsResponse(questions=[])

if __name__ == "__main__":
    import uvicorn
    import os
    # Get the PORT from the environment, defaulting to 8000 for local development
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False) # Reload is False for production
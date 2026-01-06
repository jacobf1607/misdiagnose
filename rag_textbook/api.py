"""
FastAPI server for RAG textbook queries.
Provides endpoints for the game to query medical knowledge.
"""
import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from rag.store import load_faiss, read_jsonl, embed_texts, search

load_dotenv()

app = FastAPI(title="Medical RAG API", version="1.0.0")

# CORS for Express backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
index = None
chunks = None
EMBED_MODEL = "all-mpnet-base-v2"


class SearchRequest(BaseModel):
    query: str
    top_k: int = 10


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    score: float
    meta: dict


class SearchResponse(BaseModel):
    results: List[SearchResult]


class DiseaseInfoRequest(BaseModel):
    disease_name: str
    include_symptoms: bool = True
    include_differentials: bool = True
    include_findings: bool = True


class DomainSearchRequest(BaseModel):
    domain: str  # e.g., "cardiology", "respiratory"
    query_type: str = "diseases"  # "diseases", "symptoms", "findings"
    top_k: int = 15


@app.on_event("startup")
async def load_index():
    """Load FAISS index and chunks on startup."""
    global index, chunks

    data_dir = Path("data")
    index_path = data_dir / "faiss.index"
    chunks_path = data_dir / "chunks.jsonl"

    if not index_path.exists() or not chunks_path.exists():
        raise RuntimeError("Missing data/. Run ingest.py first.")

    print("Loading FAISS index and chunks...")
    index = load_faiss(index_path)
    chunks = read_jsonl(chunks_path)
    print(f"Loaded {len(chunks)} chunks")

    # Pre-load embedding model
    print("Loading embedding model...")
    _ = embed_texts(["warmup"], model_name=EMBED_MODEL)
    print("RAG API ready!")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "chunks_loaded": len(chunks) if chunks else 0}


@app.post("/search", response_model=SearchResponse)
async def search_textbook(request: SearchRequest):
    """
    Search the textbook for relevant information.
    Returns top-k matching chunks.
    """
    if not index or not chunks:
        raise HTTPException(status_code=503, detail="Index not loaded")

    # Embed the query
    q_vec = embed_texts([request.query], model_name=EMBED_MODEL)[0]

    # Search
    scores, ids = search(index, q_vec, top_k=request.top_k)

    results = []
    for i, score in zip(ids, scores):
        if i < 0:
            continue
        chunk = chunks[i]
        results.append(SearchResult(
            chunk_id=chunk["chunk_id"],
            text=chunk["text"],
            score=float(score),
            meta=chunk["meta"]
        ))

    return SearchResponse(results=results)


@app.post("/domain-search")
async def search_by_domain(request: DomainSearchRequest):
    """
    Search for diseases, symptoms, or findings in a specific medical domain.
    Useful for case generation.
    """
    if not index or not chunks:
        raise HTTPException(status_code=503, detail="Index not loaded")

    # Construct domain-specific query
    if request.query_type == "diseases":
        query = f"{request.domain} diseases conditions differential diagnosis clinical presentation"
    elif request.query_type == "symptoms":
        query = f"{request.domain} symptoms clinical features presenting complaints"
    elif request.query_type == "findings":
        query = f"{request.domain} physical examination findings signs investigation results"
    else:
        query = f"{request.domain} {request.query_type}"

    q_vec = embed_texts([query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)

    results = []
    for i, score in zip(ids, scores):
        if i < 0:
            continue
        chunk = chunks[i]
        results.append({
            "chunk_id": chunk["chunk_id"],
            "text": chunk["text"],
            "score": float(score)
        })

    return {"domain": request.domain, "query_type": request.query_type, "results": results}


@app.post("/disease-info")
async def get_disease_info(request: DiseaseInfoRequest):
    """
    Get comprehensive information about a specific disease.
    Searches for symptoms, differential diagnosis, and findings.
    """
    if not index or not chunks:
        raise HTTPException(status_code=503, detail="Index not loaded")

    results = {}

    # Search for disease overview
    overview_query = f"{request.disease_name} definition clinical features presentation"
    q_vec = embed_texts([overview_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=5)
    results["overview"] = [chunks[i]["text"] for i in ids if i >= 0]

    if request.include_symptoms:
        symptom_query = f"{request.disease_name} symptoms signs clinical presentation complaints"
        q_vec = embed_texts([symptom_query], model_name=EMBED_MODEL)[0]
        scores, ids = search(index, q_vec, top_k=5)
        results["symptoms"] = [chunks[i]["text"] for i in ids if i >= 0]

    if request.include_differentials:
        diff_query = f"{request.disease_name} differential diagnosis differentiate distinguish"
        q_vec = embed_texts([diff_query], model_name=EMBED_MODEL)[0]
        scores, ids = search(index, q_vec, top_k=5)
        results["differentials"] = [chunks[i]["text"] for i in ids if i >= 0]

    if request.include_findings:
        findings_query = f"{request.disease_name} examination findings investigations tests results"
        q_vec = embed_texts([findings_query], model_name=EMBED_MODEL)[0]
        scores, ids = search(index, q_vec, top_k=5)
        results["findings"] = [chunks[i]["text"] for i in ids if i >= 0]

    return {"disease": request.disease_name, "info": results}


@app.post("/case-context")
async def get_case_context(request: dict):
    """
    Get RAG context for answering a patient question.
    Takes the disease, symptoms, and question to find relevant textbook info.
    """
    if not index or not chunks:
        raise HTTPException(status_code=503, detail="Index not loaded")

    disease = request.get("disease", "")
    symptoms = request.get("symptoms", "")
    question = request.get("question", "")

    # Combine into a contextual query
    query = f"{disease} {symptoms} {question}"

    q_vec = embed_texts([query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=7)

    context_chunks = []
    for i, score in zip(ids, scores):
        if i >= 0:
            context_chunks.append({
                "chunk_id": chunks[i]["chunk_id"],
                "text": chunks[i]["text"],
                "score": float(score)
            })

    return {"context": context_chunks}


class IdealPathwayRequest(BaseModel):
    disease_name: str
    domain: str
    top_k: int = 15


@app.post("/ideal-pathway")
async def get_ideal_pathway_context(request: IdealPathwayRequest):
    """
    Get comprehensive textbook context for generating the ideal diagnostic pathway.
    Searches multiple aspects: symptoms, history, examination, investigations, differentials.
    Returns structured context for creating the ideal approach to diagnose this condition.
    """
    if not index or not chunks:
        raise HTTPException(status_code=503, detail="Index not loaded")

    results = {}

    # 1. Key symptoms and clinical presentation
    symptom_query = f"{request.disease_name} symptoms clinical presentation chief complaints history"
    q_vec = embed_texts([symptom_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)
    results["symptoms"] = [
        {"text": chunks[i]["text"], "score": float(s)}
        for i, s in zip(ids, scores) if i >= 0
    ]

    # 2. Physical examination findings
    exam_query = f"{request.disease_name} physical examination signs findings inspection palpation auscultation"
    q_vec = embed_texts([exam_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)
    results["examination"] = [
        {"text": chunks[i]["text"], "score": float(s)}
        for i, s in zip(ids, scores) if i >= 0
    ]

    # 3. Investigations and tests
    test_query = f"{request.disease_name} investigations tests laboratory imaging diagnosis workup"
    q_vec = embed_texts([test_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)
    results["investigations"] = [
        {"text": chunks[i]["text"], "score": float(s)}
        for i, s in zip(ids, scores) if i >= 0
    ]

    # 4. Differential diagnosis
    diff_query = f"{request.disease_name} differential diagnosis differentiate distinguish similar conditions"
    q_vec = embed_texts([diff_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)
    results["differentials"] = [
        {"text": chunks[i]["text"], "score": float(s)}
        for i, s in zip(ids, scores) if i >= 0
    ]

    # 5. Diagnostic criteria or approach
    approach_query = f"{request.disease_name} diagnostic criteria approach algorithm diagnosis confirmation"
    q_vec = embed_texts([approach_query], model_name=EMBED_MODEL)[0]
    scores, ids = search(index, q_vec, top_k=request.top_k)
    results["diagnostic_approach"] = [
        {"text": chunks[i]["text"], "score": float(s)}
        for i, s in zip(ids, scores) if i >= 0
    ]

    return {
        "disease": request.disease_name,
        "domain": request.domain,
        "textbook_context": results
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3006))
    uvicorn.run(app, host="0.0.0.0", port=port)

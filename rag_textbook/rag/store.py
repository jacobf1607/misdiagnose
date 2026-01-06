import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer


# Global model cache
_model_cache: Dict[str, SentenceTransformer] = {}


def get_embedding_model(model_name: str = "all-mpnet-base-v2") -> SentenceTransformer:
    """Load and cache the embedding model."""
    if model_name not in _model_cache:
        print(f"Loading embedding model: {model_name}...")
        _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def embed_texts(
    texts: List[str],
    model_name: str = "all-mpnet-base-v2",
    show_progress: bool = False,
) -> np.ndarray:
    """
    Embed texts using sentence-transformers.
    Returns float32 numpy array of shape (N, D).
    """
    model = get_embedding_model(model_name)
    embeddings = model.encode(
        texts,
        show_progress_bar=show_progress,
        convert_to_numpy=True,
        normalize_embeddings=True,  # For cosine similarity
    )
    return embeddings.astype(np.float32)


def build_faiss_index(vectors: np.ndarray) -> faiss.Index:
    """
    Cosine similarity via normalized vectors + inner product index.
    """
    # Vectors are already normalized from embed_texts
    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(vectors)
    return index


def save_faiss(index: faiss.Index, path: Path) -> None:
    faiss.write_index(index, str(path))


def load_faiss(path: Path) -> faiss.Index:
    return faiss.read_index(str(path))


def search(
    index: faiss.Index, query_vec: np.ndarray, top_k: int = 6
) -> Tuple[np.ndarray, np.ndarray]:
    """
    query_vec: shape (D,) or (1,D)
    returns (scores, ids)
    """
    if query_vec.ndim == 1:
        query_vec = query_vec.reshape(1, -1)
    scores, ids = index.search(query_vec.astype(np.float32), top_k)
    return scores[0], ids[0]

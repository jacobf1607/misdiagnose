from pathlib import Path

from dotenv import load_dotenv

from rag.chunking import chunk_text
from rag.store import ensure_dir, write_jsonl, embed_texts, build_faiss_index, save_faiss


EMBED_MODEL = "all-mpnet-base-v2"


def main():
    load_dotenv()

    input_path = Path(
        r"D:\misdiagnose\textbooks\cleaned\Exam Preparatory Manual for Undergraduates Medicine, 4e_clean.txt"
    )
    out_dir = Path("data")
    ensure_dir(out_dir)

    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    print(f"Reading: {input_path}")
    raw = input_path.read_text(encoding="utf-8", errors="ignore")
    print(f"File size: {len(raw):,} characters")

    # Chunk
    print("Chunking text...")
    chunks = chunk_text(
        raw_text=raw,
        source_name=input_path.name,
        chunk_tokens=900,
        overlap_tokens=150,
    )
    print(f"Created {len(chunks)} chunks")

    rows = []
    for ch in chunks:
        rows.append(
            {
                "chunk_id": ch.chunk_id,
                "text": ch.text,
                "meta": ch.meta,
            }
        )

    chunks_path = out_dir / "chunks.jsonl"
    write_jsonl(chunks_path, rows)
    print(f"Saved chunks to: {chunks_path}")

    # Embed using local model
    print(f"Creating embeddings with {EMBED_MODEL} (this may take a few minutes)...")
    texts = [r["text"] for r in rows]
    vectors = embed_texts(texts, model_name=EMBED_MODEL, show_progress=True)
    print(f"Embeddings shape: {vectors.shape}")

    # Index
    print("Building FAISS index...")
    index = build_faiss_index(vectors)
    index_path = out_dir / "faiss.index"
    save_faiss(index, index_path)

    print("\n" + "=" * 50)
    print("DONE!")
    print(f"Chunks: {len(rows)} -> {chunks_path}")
    print(f"FAISS index -> {index_path}")
    print(f"Embedding model: {EMBED_MODEL}")
    print("=" * 50)


if __name__ == "__main__":
    main()

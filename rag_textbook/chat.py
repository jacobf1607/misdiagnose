import os
from pathlib import Path

from dotenv import load_dotenv
import anthropic

from rag.store import load_faiss, read_jsonl, embed_texts, search
from rag.prompts import SYSTEM_PROMPT, build_user_prompt


EMBED_MODEL = "all-mpnet-base-v2"


def main():
    load_dotenv()

    # Anthropic for chat
    anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    data_dir = Path("data")
    index_path = data_dir / "faiss.index"
    chunks_path = data_dir / "chunks.jsonl"

    if not index_path.exists() or not chunks_path.exists():
        raise RuntimeError("Missing data/. Run ingest.py first.")

    print("Loading index and chunks...")
    index = load_faiss(index_path)
    rows = read_jsonl(chunks_path)
    print(f"Loaded {len(rows)} chunks")

    # faiss ids correspond to insertion order
    by_pos = rows

    chat_model = "claude-sonnet-4-20250514"

    print("\n" + "=" * 50)
    print("RAG Medical Assistant Ready")
    print(f"Embedding: {EMBED_MODEL} (local)")
    print(f"Chat: {chat_model}")
    print("Type your question. Type 'exit' to quit.")
    print("=" * 50 + "\n")

    # Pre-load embedding model
    print("Loading embedding model...")
    _ = embed_texts(["warmup"], model_name=EMBED_MODEL)
    print("Ready!\n")

    while True:
        try:
            q = input("You: ").strip()
        except EOFError:
            break

        if not q:
            continue
        if q.lower() in {"exit", "quit", "q"}:
            print("Goodbye!")
            break

        # Embed the question using local model
        q_vec = embed_texts([q], model_name=EMBED_MODEL)[0]

        # Search for relevant chunks
        scores, ids = search(index, q_vec, top_k=7)

        contexts = []
        for i, score in zip(ids, scores):
            if i < 0:
                continue
            r = by_pos[i]
            contexts.append(
                {"chunk_id": r["chunk_id"], "text": r["text"], "meta": r["meta"]}
            )

        user_prompt = build_user_prompt(q, contexts)

        # Generate response using Claude
        response = anthropic_client.messages.create(
            model=chat_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_prompt},
            ],
        )

        answer = response.content[0].text
        print(f"\nAssistant:\n{answer}\n")


if __name__ == "__main__":
    main()

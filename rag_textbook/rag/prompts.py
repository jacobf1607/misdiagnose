SYSTEM_PROMPT = """You are a careful medical-study assistant.
You must only answer using the provided context.
If the context is insufficient, say you don't know and ask what to look up.

Rules:
- Be precise and structured.
- Prefer bullet points for differential diagnoses, criteria, tables, etc.
- Always cite sources using the chunk ids like [chunk_00012].
- Do not invent guidelines or drug doses not present in context.
"""


def build_user_prompt(question: str, contexts: list[dict]) -> str:
    """
    contexts: list of {"chunk_id":..., "text":...}
    """
    ctx_blocks = []
    for c in contexts:
        ctx_blocks.append(f"[{c['chunk_id']}]\n{c['text']}")
    ctx = "\n\n---\n\n".join(ctx_blocks)

    return f"""Question:
{question}

Context:
{ctx}

Answer using only the Context. Include chunk citations like [chunk_00012]."""

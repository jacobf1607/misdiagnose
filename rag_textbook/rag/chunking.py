import re
from dataclasses import dataclass
from typing import List, Dict, Any

import tiktoken


@dataclass
class Chunk:
    chunk_id: str
    text: str
    meta: Dict[str, Any]


def _normalize_text(s: str) -> str:
    """Keep it conservative: just normalize whitespace."""
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def chunk_text(
    raw_text: str,
    source_name: str,
    chunk_tokens: int = 900,
    overlap_tokens: int = 150,
    encoding_name: str = "cl100k_base",
) -> List[Chunk]:
    """
    Token-based chunking with overlap. Conservative: does NOT try to rewrite content.
    """
    enc = tiktoken.get_encoding(encoding_name)
    text = _normalize_text(raw_text)

    tokens = enc.encode(text)
    chunks: List[Chunk] = []

    start = 0
    idx = 0
    n = len(tokens)

    while start < n:
        end = min(start + chunk_tokens, n)
        chunk_tok = tokens[start:end]
        chunk_txt = enc.decode(chunk_tok).strip()

        chunk_id = f"chunk_{idx:05d}"
        meta = {
            "source": source_name,
            "token_start": start,
            "token_end": end,
        }
        chunks.append(Chunk(chunk_id=chunk_id, text=chunk_txt, meta=meta))

        idx += 1
        if end == n:
            break
        start = max(0, end - overlap_tokens)

    return chunks

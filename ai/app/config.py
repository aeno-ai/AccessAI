"""Settings, all overridable from backend/.env (the launcher passes it on)."""
import os
from pathlib import Path

AI_DIR = Path(__file__).resolve().parents[1]

# Where the AI models run: "ollama" (this computer, `ollama serve`) or
# "gemini" (Google's cloud, needs GEMINI_API_KEY — no Ollama, works on a
# small server).
PROVIDER = os.environ.get("AI_PROVIDER", "ollama").strip().lower()
GEMINI = PROVIDER == "gemini"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
# The "understander": a chat model that picks an action from a short list
# and pulls out details like a friend's name. Locally a small one (~3
# billion parameters); in the cloud a fast Gemini model.
# (gemini-2.5-* are closed to new keys since 2026; 3.5-flash-lite answered
# Laya's test questions right in ~1 s.)
CHAT_MODEL = os.environ.get("AI_CHAT_MODEL", "gemini-3.5-flash-lite" if GEMINI else "qwen2.5:3b")
# Turns a sentence into a list of numbers (an "embedding") so sentences with
# similar meaning get similar numbers. bge-m3 (local, 1024 numbers) and
# gemini-embedding-001 (cloud, 768 here) understand English, Filipino and
# Taglish.
EMBED_MODEL = os.environ.get("AI_EMBED_MODEL", "gemini-embedding-001" if GEMINI else "bge-m3")
EMBED_DIMS = int(os.environ.get("AI_EMBED_DIMS", "768"))  # Gemini only
# Keep the models loaded in memory this long after their last use (Ollama).
KEEP_ALIVE = os.environ.get("AI_KEEP_ALIVE", "1h")

# When set, every request must carry it in X-AI-Key (the backend sends it).
# Needed once the service has a public address, e.g. on Render.
SHARED_KEY = os.environ.get("AI_SHARED_KEY", "")

# How sure the vector search must be (cosine similarity, 0–1). Each
# embedding model spreads its scores differently, so each has its own
# defaults (tuned with `python -m app.eval`). gemini-embedding-001 scores
# everything high (unrelated sentences ~0.7), so its bar is higher; tuned
# 2026-10-22 on eval.jsonl: 64/66 right, flat from HIGH 0.92 to 0.95.
_DEFAULTS = {"high": "0.93", "margin": "0.03", "low": "0.60"} if GEMINI else {"high": "0.82", "margin": "0.04", "low": "0.50"}
HIGH = float(os.environ.get("AI_HIGH", _DEFAULTS["high"]))      # at least this AND a clear lead → answer without the LLM
MARGIN = float(os.environ.get("AI_MARGIN", _DEFAULTS["margin"]))  # "clear lead" over the next-best action
LOW = float(os.environ.get("AI_LOW", _DEFAULTS["low"]))         # below this → "I didn't catch that"
TOP_K = int(os.environ.get("AI_TOPK", "12"))        # how many nearest examples to look at
LLM_CANDIDATES = 5                                   # how many actions the LLM may choose between

# The example sentences' embeddings, saved so a restart doesn't redo them
# (one file per embedding model; the Gemini one is committed, so a fresh
# server spends none of the free quota on it).
INDEX_DIR = AI_DIR / "index-cache"
INTENTS_FILE = AI_DIR / "intents.json"

DEBUG = os.environ.get("AI_DEBUG") == "1"

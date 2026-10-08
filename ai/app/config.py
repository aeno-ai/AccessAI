"""Settings, all overridable from backend/.env (the launcher passes it on)."""
import os
from pathlib import Path

AI_DIR = Path(__file__).resolve().parents[1]

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
# The "understander": a small chat model (~3 billion parameters) that picks
# an action from a short list and pulls out details like a friend's name.
CHAT_MODEL = os.environ.get("AI_CHAT_MODEL", "qwen2.5:3b")
# Turns a sentence into a list of 1024 numbers (an "embedding") so sentences
# with similar meaning get similar numbers. bge-m3 understands English,
# Filipino and Taglish.
EMBED_MODEL = os.environ.get("AI_EMBED_MODEL", "bge-m3")
# Keep the models loaded in memory this long after their last use.
KEEP_ALIVE = os.environ.get("AI_KEEP_ALIVE", "1h")

# How sure the vector search must be (cosine similarity, 0–1):
HIGH = float(os.environ.get("AI_HIGH", "0.82"))     # at least this AND a clear lead → answer without the LLM
MARGIN = float(os.environ.get("AI_MARGIN", "0.04"))  # "clear lead" over the next-best action
LOW = float(os.environ.get("AI_LOW", "0.50"))       # below this → "I didn't catch that"
TOP_K = int(os.environ.get("AI_TOPK", "12"))        # how many nearest examples to look at
LLM_CANDIDATES = 5                                   # how many actions the LLM may choose between

CHROMA_DIR = AI_DIR / ".chroma"
INTENTS_FILE = AI_DIR / "intents.json"

DEBUG = os.environ.get("AI_DEBUG") == "1"

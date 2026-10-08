"""AccessAI's AI service — started by `npm run dev` in backend/ (see
backend/scripts/startAi.js). Only reachable from this computer; the phone
talks to the Node backend, which checks the login and forwards here.

  Accel (voice assistant):   POST /interpret, POST /polish   (needs Ollama)
  Sign language:             GET /sign/models, POST /sign/session,
                             POST /sign/session/{id}/chunk, DELETE /sign/session/{id}
  Status:                    GET /health

Sign language works as soon as this starts. Accel waits for Ollama
(`ollama serve`), downloads its two models the first time, builds the
vector index, then reports ready.
"""
import asyncio
import json
import sys
from contextlib import asynccontextmanager

sys.modules.setdefault("tensorflow", None)  # see sign/features.py

from fastapi import FastAPI, Header, HTTPException, Request  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import config, ollama  # noqa: E402
from .index import IntentIndex  # noqa: E402
from .interpret import interpret  # noqa: E402
from .polish import polish  # noqa: E402
from .sign import registry  # noqa: E402
from .sign.session import SessionGone, SessionStore, process_bytes  # noqa: E402

state = {"ready": False, "status": "starting", "catalog": None, "index": None, "sign_models": {}}
sessions = SessionStore()


def log(message):
    print(f"[ai] {message}", flush=True)


async def bootstrap():
    """Waits for Ollama, downloads missing models, builds the vector index."""
    state["catalog"] = json.loads(config.INTENTS_FILE.read_text(encoding="utf-8"))
    told = False
    while True:
        try:
            version = await ollama.version()
            log(f"Ollama {version} found.")
            break
        except ollama.OllamaDown:
            state["status"] = "waiting for Ollama"
            if not told:
                log("Accel is waiting for Ollama — start it with `ollama serve` (or open the Ollama app).")
                told = True
            await asyncio.sleep(10)
    while True:
        try:
            state["status"] = "downloading models"
            await ollama.ensure_models([config.EMBED_MODEL, config.CHAT_MODEL], log)
            state["status"] = "building the vector index"
            index = IntentIndex()
            await index.build(state["catalog"], log)
            state["index"] = index
            state["status"] = "warming up"
            log(f"Loading {config.CHAT_MODEL} into memory…")
            try:
                await ollama.chat_json("Reply as JSON.", "Say ok.", {"type": "object", "properties": {"ok": {"type": "string"}}},
                                       max_tokens=5, timeout=180)
            except ollama.OllamaDown:
                pass
            state["ready"] = True
            state["status"] = "ready"
            log("Accel's AI is ready.")
            return
        except Exception as error:  # noqa: BLE001 — keep trying; the backend works without us
            state["status"] = "retrying"
            log(f"Setup didn't finish ({error}). Trying again in 15 s…")
            await asyncio.sleep(15)


@asynccontextmanager
async def lifespan(_app):
    state["sign_models"] = registry.load_all()
    for model in state["sign_models"].values():
        status = f"{len(model.labels)} signs" if model.available else model.problem
        log(f"Sign model {model.language.upper()} {model.unit}: {status}")
    task = asyncio.create_task(bootstrap())
    yield
    task.cancel()


app = FastAPI(title="AccessAI AI service", lifespan=lifespan, docs_url="/docs" if config.DEBUG else None, redoc_url=None)


# ---------------------------------------------------------------- status
@app.get("/health")
async def health():
    return {
        "ready": state["ready"],
        "status": state["status"],
        "chatModel": config.CHAT_MODEL,
        "embedModel": config.EMBED_MODEL,
        "sign": [model.describe() for model in state["sign_models"].values()],
    }


# ---------------------------------------------------------------- Accel
class InterpretRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    screen: str | None = Field(default=None, max_length=100)


class PolishRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    kind: str = Field(pattern="^(message|gloss)$")
    language: str = Field(default="auto", pattern="^(en|fil|fsl|asl|auto)$")


def _require_ready():
    if not state["ready"]:
        raise HTTPException(503, f"not ready: {state['status']}")


@app.post("/interpret")
async def interpret_route(body: InterpretRequest):
    _require_ready()
    try:
        result = await interpret(body.text, state["catalog"], state["index"], body.screen)
    except ollama.OllamaDown as error:
        raise HTTPException(503, "Ollama didn't answer") from error
    if not config.DEBUG:
        for key in ("debug", "timings", "why"):
            result.pop(key, None)
    return result


@app.post("/polish")
async def polish_route(body: PolishRequest):
    _require_ready()
    try:
        return {"text": await polish(body.text, body.kind, body.language)}
    except ollama.OllamaDown as error:
        raise HTTPException(503, "Ollama didn't answer") from error


if config.DEBUG:
    @app.get("/debug/search")
    async def debug_search(q: str):
        """See the vector search at work: the nearest examples and their scores."""
        _require_ready()
        [embedding] = await ollama.embed([q])
        return [{"intent": i, "similarity": round(s, 3), "example": e}
                for i, s, e in state["index"].nearest(embedding, config.TOP_K)]


# ---------------------------------------------------------------- sign language
class StartSession(BaseModel):
    language: str = Field(pattern="^(fsl|asl)$")
    unit: str = Field(pattern="^(words|letters)$")
    minConfidence: float | None = Field(default=None, ge=0.05, le=0.99)
    # Flip the video left↔right first (like the tester's X key) — for phones
    # whose front camera saves mirrored video. The models need it unmirrored.
    flip: bool = False
    owner: str = Field(min_length=1, max_length=64)


@app.get("/sign/models")
async def sign_models():
    return {"models": [model.describe() for model in state["sign_models"].values()]}


@app.post("/sign/session")
async def start_session(body: StartSession):
    model = state["sign_models"].get((body.language, body.unit))
    if model is None or not model.available:
        raise HTTPException(409, f"{body.language.upper()} {body.unit}: {model.problem if model else 'unknown'}")
    min_confidence = body.minConfidence or model.min_confidence
    session = await run_in_threadpool(sessions.create, body.owner, model, min_confidence, body.flip)
    return {"sessionId": session.id, "language": body.language, "unit": body.unit, "minConfidence": min_confidence}


@app.post("/sign/session/{session_id}/chunk")
async def send_chunk(
    session_id: str,
    request: Request,
    x_owner: str = Header(),
    x_chunk_start: int = Header(),
    x_chunk_final: str | None = Header(default=None),
):
    try:
        session = sessions.get(session_id, x_owner)
    except SessionGone as error:
        raise HTTPException(404, "session gone") from error
    data = await request.body()
    if not data:
        raise HTTPException(400, "empty video")
    return await run_in_threadpool(process_bytes, session, data, x_chunk_start, x_chunk_final == "1")


@app.delete("/sign/session/{session_id}")
async def stop_session(session_id: str, x_owner: str = Header()):
    await run_in_threadpool(sessions.delete, session_id, x_owner)
    return {"stopped": True}

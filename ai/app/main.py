"""AccessAI's AI service — started by `npm run dev` in backend/ (see
backend/scripts/startAi.js). Only reachable from this computer; the phone
talks to the Node backend, which checks the login and forwards here.

  Laya (voice assistant):   POST /interpret, POST /polish   (needs Ollama)
  Sign language:             GET /sign/models, POST /sign/session,
                             POST /sign/session/{id}/chunk, DELETE /sign/session/{id}
  Status:                    GET /health

Sign language works as soon as this starts. Laya waits for Ollama
(`ollama serve`), downloads its two models the first time, builds the
vector index, then reports ready. With AI_PROVIDER=gemini the models run in
Google's cloud instead (app/gemini.py), so it can also run on a small server.
"""
import asyncio
import hmac
import json
import sys
from contextlib import asynccontextmanager

sys.modules.setdefault("tensorflow", None)  # see sign/features.py

from fastapi import FastAPI, Header, HTTPException, Request  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import config, ollama  # noqa: E402
from .index import IntentIndex  # noqa: E402
from .interpret import interpret  # noqa: E402
from .polish import polish  # noqa: E402
from .sign import registry  # noqa: E402
from .sign.session import SessionGone, SessionsBusy, SessionStore, process_bytes  # noqa: E402

state = {"ready": False, "status": "starting", "catalog": None, "index": None, "sign_models": {}}
sessions = SessionStore()


def log(message):
    print(f"[ai] {message}", flush=True)


async def bootstrap():
    """Waits for Ollama, downloads missing models, builds the vector index
    (with AI_PROVIDER=gemini: checks the key, builds the index)."""
    state["catalog"] = json.loads(config.INTENTS_FILE.read_text(encoding="utf-8"))
    if config.GEMINI:
        await bootstrap_gemini()
        return
    told = False
    while True:
        try:
            version = await ollama.version()
            log(f"Ollama {version} found.")
            break
        except ollama.OllamaDown:
            state["status"] = "waiting for Ollama"
            if not told:
                log("Laya is waiting for Ollama — start it with `ollama serve` (or open the Ollama app).")
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
            log("Laya's AI is ready.")
            return
        except Exception as error:  # noqa: BLE001 — keep trying; the backend works without us
            state["status"] = "retrying"
            log(f"Setup didn't finish ({error}). Trying again in 15 s…")
            await asyncio.sleep(15)


async def bootstrap_gemini():
    """The cloud runs the models: no Ollama to wait for, nothing to download."""
    from . import gemini

    if not config.GEMINI_API_KEY:
        state["status"] = "GEMINI_API_KEY is not set"
        log("AI_PROVIDER=gemini but GEMINI_API_KEY is empty — Laya uses only the phone's rules.")
        return
    while True:
        try:
            state["status"] = "building the vector index"
            index = IntentIndex()
            await index.build(state["catalog"], log)
            state["index"] = index
            state["status"] = "checking Gemini"
            await gemini.check()
            state["ready"] = True
            state["status"] = "ready"
            log(f"Laya's AI is ready (Gemini: {config.CHAT_MODEL} + {config.EMBED_MODEL}).")
            return
        except Exception as error:  # noqa: BLE001 — keep trying; the backend works without us
            state["status"] = "retrying"
            log(f"Setup didn't finish ({error}). Trying again in 30 s…")
            await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(_app):
    state["sign_models"] = registry.load_all()
    for model in state["sign_models"].values():
        status = f"{len(model.labels)} signs" if model.available else model.problem
        log(f"Sign model {model.language.upper()} {model.unit}: {status}")
    task = asyncio.create_task(bootstrap())
    yield
    task.cancel()
    await ollama.close()


app = FastAPI(title="AccessAI AI service", lifespan=lifespan, docs_url="/docs" if config.DEBUG else None, redoc_url=None)


# With a public address (e.g. Render), only the backend may call us: it
# sends AI_SHARED_KEY in X-AI-Key. Without it anyone could use up the
# Gemini quota. Unset (on this computer, 127.0.0.1 only) → not checked.
# /health stays open: the host's health check can't send the key, and it
# only says whether Laya is ready and which models run.
@app.middleware("http")
async def require_shared_key(request: Request, call_next):
    if (
        config.SHARED_KEY
        and request.url.path != "/health"
        and not hmac.compare_digest(request.headers.get("x-ai-key", ""), config.SHARED_KEY)
    ):
        return JSONResponse({"detail": "forbidden"}, status_code=403)
    return await call_next(request)


# ---------------------------------------------------------------- status
@app.get("/health")
async def health():
    return {
        "ready": state["ready"],
        "status": state["status"],
        "provider": config.PROVIDER,
        "chatModel": config.CHAT_MODEL,
        "embedModel": config.EMBED_MODEL,
        "sign": [model.describe() for model in state["sign_models"].values()],
    }


# ---------------------------------------------------------------- Laya
class InterpretRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    screen: str | None = Field(default=None, max_length=100)


class PolishRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    kind: str = Field(pattern="^(message|gloss|spell|translate)$")
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
    try:
        session = await run_in_threadpool(sessions.create, body.owner, model, min_confidence, body.flip)
    except SessionsBusy as error:
        # The backend turns this into "Sign language isn't working right now."
        raise HTTPException(503, "busy") from error
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

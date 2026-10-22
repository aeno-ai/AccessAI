"""A small client for Ollama's local HTTP API (http://127.0.0.1:11434).

Ollama runs the AI models on this computer. Start it with `ollama serve`
(or the Ollama app). Everything here talks to it over plain HTTP.

With AI_PROVIDER=gemini, embed() and chat_json() hand over to app/gemini.py
(Google's cloud) instead — same answers, same errors, no Ollama needed.
"""
import asyncio
import json

import httpx

from . import config


class OllamaDown(Exception):
    """Ollama isn't running, or didn't answer in time."""


class OllamaBusy(OllamaDown):
    """Both slots are in use (see _slots): answered at once instead of queueing."""


# One HTTP client for the whole service, made on first use: it keeps its
# connections to Ollama open instead of opening a new one for every call.
# Each call still sets its own timeout. Closed when the service stops.
_shared = None


def _client():
    global _shared
    if _shared is None:
        _shared = httpx.AsyncClient(base_url=config.OLLAMA_URL, timeout=60.0)
    return _shared


async def close():
    global _shared
    if _shared is not None:
        await _shared.aclose()
        _shared = None
    if config.GEMINI:
        from . import gemini

        await gemini.close()


# Ollama works through one request at a time; more just wait in its queue.
# At most 2 of ours at once (one running, one next). A third is refused
# straight away, so the person's phone falls back to its own rules instead
# of waiting.
_slots = asyncio.Semaphore(2)


def _take_slot():
    if _slots.locked():
        raise OllamaBusy("busy")
    return _slots


async def version():
    try:
        response = await _client().get("/api/version", timeout=3)
        response.raise_for_status()
        return response.json().get("version")
    except httpx.HTTPError as error:
        raise OllamaDown(str(error)) from error


async def installed_models():
    response = await _client().get("/api/tags", timeout=5)
    response.raise_for_status()
    return {model["name"] for model in response.json().get("models", [])}


def _same_model(wanted, installed):
    # "bge-m3" is stored as "bge-m3:latest".
    return wanted in installed or f"{wanted}:latest" in installed


async def pull(model, log):
    """Downloads a model, printing progress every 10%."""
    log(f"Downloading {model} (first time only)…")
    last_step = -1
    async with _client().stream("POST", "/api/pull", json={"model": model, "stream": True}, timeout=None) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line:
                continue
            status = json.loads(line)
            if status.get("error"):
                raise RuntimeError(status["error"])
            total, done = status.get("total"), status.get("completed")
            if total and done:
                step = int(done / total * 10)
                if step != last_step:
                    last_step = step
                    log(f"  {model}: {step * 10}%")
    log(f"{model} is ready.")


async def ensure_models(models, log):
    installed = await installed_models()
    for model in models:
        if not _same_model(model, installed):
            await pull(model, log)


async def embed(texts):
    """Sentences → embeddings (one list of numbers per sentence)."""
    if config.GEMINI:  # AI_PROVIDER=gemini: the cloud does it (app/gemini.py)
        from . import gemini

        return await gemini.embed(texts)
    try:
        async with _take_slot():
            response = await _client().post(
                "/api/embed",
                json={"model": config.EMBED_MODEL, "input": texts, "keep_alive": config.KEEP_ALIVE},
                timeout=60,
            )
            response.raise_for_status()
            return response.json()["embeddings"]
    except httpx.HTTPError as error:
        raise OllamaDown(str(error)) from error


async def chat_json(system, user, schema, max_tokens=160, timeout=30.0):
    """Asks the chat model and forces its answer to match `schema` (a JSON
    schema). Ollama only lets the model produce text that fits the schema —
    e.g. an `enum` means it literally cannot answer anything outside it."""
    if config.GEMINI:
        from . import gemini

        return await gemini.chat_json(system, user, schema, max_tokens=max_tokens, timeout=timeout)
    try:
        async with _take_slot():
            response = await _client().post(
                "/api/chat",
                json={
                    "model": config.CHAT_MODEL,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "format": schema,
                    "stream": False,
                    "keep_alive": config.KEEP_ALIVE,
                    "options": {"temperature": 0, "num_predict": max_tokens},
                },
                timeout=timeout,
            )
            response.raise_for_status()
            return json.loads(response.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise OllamaDown(str(error)) from error

"""A small client for Ollama's local HTTP API (http://127.0.0.1:11434).

Ollama runs the AI models on this computer. Start it with `ollama serve`
(or the Ollama app). Everything here talks to it over plain HTTP.
"""
import json

import httpx

from . import config


class OllamaDown(Exception):
    """Ollama isn't running, or didn't answer in time."""


def _client(timeout=60.0):
    return httpx.AsyncClient(base_url=config.OLLAMA_URL, timeout=timeout)


async def version():
    try:
        async with _client(3) as client:
            response = await client.get("/api/version")
            response.raise_for_status()
            return response.json().get("version")
    except httpx.HTTPError as error:
        raise OllamaDown(str(error)) from error


async def installed_models():
    async with _client(5) as client:
        response = await client.get("/api/tags")
        response.raise_for_status()
        return {model["name"] for model in response.json().get("models", [])}


def _same_model(wanted, installed):
    # "bge-m3" is stored as "bge-m3:latest".
    return wanted in installed or f"{wanted}:latest" in installed


async def pull(model, log):
    """Downloads a model, printing progress every 10%."""
    log(f"Downloading {model} (first time only)…")
    last_step = -1
    async with _client(None) as client:
        async with client.stream("POST", "/api/pull", json={"model": model, "stream": True}) as response:
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
    try:
        async with _client(60) as client:
            response = await client.post(
                "/api/embed",
                json={"model": config.EMBED_MODEL, "input": texts, "keep_alive": config.KEEP_ALIVE},
            )
            response.raise_for_status()
            return response.json()["embeddings"]
    except httpx.HTTPError as error:
        raise OllamaDown(str(error)) from error


async def chat_json(system, user, schema, max_tokens=160, timeout=30.0):
    """Asks the chat model and forces its answer to match `schema` (a JSON
    schema). Ollama only lets the model produce text that fits the schema —
    e.g. an `enum` means it literally cannot answer anything outside it."""
    try:
        async with _client(timeout) as client:
            response = await client.post(
                "/api/chat",
                json={
                    "model": config.CHAT_MODEL,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "format": schema,
                    "stream": False,
                    "keep_alive": config.KEEP_ALIVE,
                    "options": {"temperature": 0, "num_predict": max_tokens},
                },
            )
            response.raise_for_status()
            return json.loads(response.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise OllamaDown(str(error)) from error

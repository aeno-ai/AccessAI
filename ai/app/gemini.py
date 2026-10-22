"""A small client for Google's Gemini API — the cloud stand-in for Ollama
(AI_PROVIDER=gemini). Same two jobs, same answers:

  * embed(texts)       sentences → embeddings (lists of numbers)
  * chat_json(...)     ask the chat model; its answer must fit a JSON schema

Errors are raised as ollama.OllamaDown, so the rest of the service (and the
phone's fallback to its own rules) works the same whichever runs the models.
"""
import asyncio
import copy
import json

import httpx

from . import config
from .ollama import OllamaBusy, OllamaDown

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# One HTTP client for the whole service, made on first use.
_shared = None


def _client():
    global _shared
    if _shared is None:
        _shared = httpx.AsyncClient(
            base_url=BASE_URL, timeout=30.0, headers={"x-goog-api-key": config.GEMINI_API_KEY}
        )
    return _shared


async def close():
    global _shared
    if _shared is not None:
        await _shared.aclose()
        _shared = None


# The cloud answers many at once, but the free plan allows only so many
# requests a minute: at most 4 of ours at a time, a 5th is refused straight
# away (the phone then uses its own rules instead of waiting).
_slots = asyncio.Semaphore(4)


def _take_slot():
    if _slots.locked():
        raise OllamaBusy("busy")
    return _slots


def _model_path(model):
    return model if model.startswith("models/") else f"models/{model}"


async def _post(path, body, timeout):
    if not config.GEMINI_API_KEY:
        raise OllamaDown("GEMINI_API_KEY is not set")
    try:
        response = await _client().post(path, json=body, timeout=timeout)
    except httpx.HTTPError as error:
        raise OllamaDown(f"{type(error).__name__}: {error}") from error
    if response.status_code != 200:
        try:
            message = response.json().get("error", {}).get("message", "")
        except ValueError:
            message = response.text[:200]
        raise OllamaDown(f"Gemini {response.status_code}: {message[:300]}")
    return response.json()


async def check():
    """Raises OllamaDown unless the key works and both models answer."""
    await embed(["ok"])
    await chat_json("Reply as JSON.", "Say ok.", {"type": "object", "properties": {"ok": {"type": "string"}}}, max_tokens=20)


async def embed(texts):
    """Sentences → embeddings (one list of numbers per sentence)."""
    model = _model_path(config.EMBED_MODEL)
    body = {
        "requests": [
            {
                "model": model,
                "content": {"parts": [{"text": text}]},
                # Both sides are short sentences compared for meaning.
                "taskType": "SEMANTIC_SIMILARITY",
                "outputDimensionality": config.EMBED_DIMS,
            }
            for text in texts
        ]
    }
    async with _take_slot():
        data = await _post(f"/{model}:batchEmbedContents", body, timeout=30)
    try:
        return [item["values"] for item in data["embeddings"]]
    except (KeyError, TypeError) as error:
        raise OllamaDown(f"unexpected embedding answer: {error}") from error


# Gemini's schema mode understands an OpenAPI subset: types, properties,
# required, enum… but not length limits, and an enum can't hold "". The
# answer is checked by our own code afterwards, so those are dropped here.
_UNSUPPORTED = {"maxLength", "minLength", "additionalProperties", "$schema"}


def _gemini_schema(schema):
    schema = copy.deepcopy(schema)

    def clean(node):
        if isinstance(node, dict):
            for key in _UNSUPPORTED & node.keys():
                del node[key]
            if "enum" in node:
                node["enum"] = [value for value in node["enum"] if value != ""]
                if not node["enum"]:
                    del node["enum"]
            for value in node.values():
                clean(value)
        elif isinstance(node, list):
            for value in node:
                clean(value)

    clean(schema)
    return schema


def _thinking(model):
    # Thinking makes answers slow and uses up the token budget; Laya's
    # choices are short and simple. 2.5 models switch it off with a budget
    # of 0, newer ones go to their lowest level.
    if "2.5" in model or "2.0" in model:
        return {"thinkingBudget": 0}
    return {"thinkingLevel": "minimal"}


async def chat_json(system, user, schema, max_tokens=160, timeout=30.0):
    """Asks the chat model and forces its answer to match `schema`."""
    model = _model_path(config.CHAT_MODEL)
    generation = {
        "temperature": 0,
        # Gemini stops tiny budgets early even when the answer is ~5 tokens
        # (finishReason MAX_TOKENS, cut-off JSON), so never less than 256 —
        # short answers still end as soon as they're done.
        "maxOutputTokens": max(max_tokens, 256),
        "responseMimeType": "application/json",
        "responseSchema": _gemini_schema(schema),
        "thinkingConfig": _thinking(config.CHAT_MODEL),
    }
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": generation,
    }
    async with _take_slot():
        data = await _post(f"/{model}:generateContent", body, timeout=timeout)
    try:
        text = "".join(part.get("text", "") for part in data["candidates"][0]["content"]["parts"])
        return json.loads(text)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        reason = (data.get("candidates") or [{}])[0].get("finishReason") or data.get("promptFeedback", {})
        raise OllamaDown(f"unusable Gemini answer ({reason}): {error}") from error

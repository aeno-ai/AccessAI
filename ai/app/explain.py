"""See how Accel understands a sentence, step by step. Ollama must be running.

    cd ai
    .venv\\Scripts\\python -m app.explain "i want to talk with someone"
    .venv\\Scripts\\python -m app.explain          (type sentences one by one)

It prints the nearest example sentences found by the vector search (with
their cosine similarity), whether that was sure enough on its own, and —
if not — what the LLM chose from the shortlist.
"""
import asyncio
import json
import sys

from . import config
from .index import IntentIndex
from .interpret import best_per_intent, interpret
from . import ollama


async def explain(sentence, catalog, index):
    [embedding] = await ollama.embed([sentence])
    hits = index.nearest(embedding, config.TOP_K)
    print(f'\n"{sentence}"')
    print(f"  1) Vector search — the {len(hits)} nearest examples (1.0 = same meaning):")
    for intent, score, example in hits[:8]:
        print(f"       {score:.3f}  {intent:<24} \"{example}\"")
    ranked = best_per_intent(hits)
    top, second = ranked[0], ranked[1] if len(ranked) > 1 else (None, 0.0, None)
    print(f"  2) Best action {top[0]} at {top[1]:.3f}; runner-up {second[0]} at {second[1]:.3f} "
          f"(lead {top[1] - second[1]:.3f}).")
    print(f"     Rules: below {config.LOW} → none; at least {config.HIGH} with a lead of {config.MARGIN} "
          f"and no details needed → answer without the LLM; otherwise ask the LLM.")
    result = await interpret(sentence, catalog, index)
    print(f"  3) Decision: {result['intent']}  slots={json.dumps(result['slots'], ensure_ascii=False)}  "
          f"via {result['source']} ({result.get('why')})  timings={result.get('timings')}")


async def main():
    catalog = json.loads(config.INTENTS_FILE.read_text(encoding="utf-8"))
    index = IntentIndex()
    await index.build(catalog, print)
    sentences = sys.argv[1:]
    if sentences:
        for sentence in sentences:
            await explain(sentence, catalog, index)
        return
    print("Type a sentence (empty line to quit).")
    while True:
        sentence = input("> ").strip()
        if not sentence:
            return
        await explain(sentence, catalog, index)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ollama.OllamaDown:
        print("Ollama isn't running. Start it with `ollama serve`, then try again.")

"""Scores Accel on ai/eval.jsonl — sentences NOT in intents.json, each with
the action it should map to. Use it after changing examples or thresholds:

    cd ai
    .venv\\Scripts\\python -m app.eval

Prints accuracy, how often the LLM was needed, and every miss.
"""
import asyncio
import json
import time

from . import config, ollama
from .index import IntentIndex
from .interpret import interpret


async def main():
    catalog = json.loads(config.INTENTS_FILE.read_text(encoding="utf-8"))
    index = IntentIndex()
    await index.build(catalog, print)
    cases = [json.loads(line) for line in (config.AI_DIR / "eval.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    right, used_llm, misses = 0, 0, []
    started = time.perf_counter()
    for case in cases:
        result = await interpret(case["text"], catalog, index)
        used_llm += result["source"] == "llm"
        ok = result["intent"] == case["intent"]
        for key, value in case.get("slots", {}).items():
            ok = ok and str(result["slots"].get(key, "")).lower() == str(value).lower()
        right += ok
        mark = "✓" if ok else "✗"
        print(f"  {mark} {case['text']!r} → {result['intent']} {result['slots'] or ''} ({result['source']})")
        if not ok:
            misses.append((case, result))
    seconds = time.perf_counter() - started
    print(f"\n{right}/{len(cases)} right ({right / len(cases):.0%}); LLM needed {used_llm} times; "
          f"{seconds / len(cases):.1f} s per sentence on average.")
    for case, result in misses:
        print(f"  missed: {case['text']!r} wanted {case['intent']} {case.get('slots', '')}, got {result['intent']} {result['slots']}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ollama.OllamaDown:
        print("Ollama isn't running. Start it with `ollama serve`, then try again.")

"""The vector index: Laya's memory of example sentences.

How it works, in plain words:
  1. intents.json lists every action Laya can do, each with example
     sentences ("take me to conversation mode", "gusto kong makipag-usap"…).
  2. Each example is turned into an EMBEDDING — a list of numbers that
     captures its meaning (bge-m3 in Ollama, or gemini-embedding-001 in the
     cloud). Sentences that mean similar things get similar numbers, even in
     different words or languages.
  3. Those numbers are kept in memory as one table (numpy) and saved to
     ai/index-cache/, so a restart doesn't redo them. With ~500 sentences,
     comparing a new sentence against every one takes well under a
     millisecond — no separate vector database needed.
     "Closest" = cosine similarity: 1.0 is the same direction (same
     meaning), 0 is unrelated.
  4. When someone talks to Laya, their sentence is embedded the same way
     and the nearest examples tell us which action they most likely mean.

The index is rebuilt automatically whenever intents.json (or the embedding
model) changes — just edit the JSON and restart.
"""
import asyncio
import hashlib
import json

import numpy as np

from . import config, ollama

# Sentences per embedding request (Gemini takes up to 100 at once).
BATCH = 100 if config.GEMINI else 32


def catalog_hash(catalog):
    text = config.EMBED_MODEL + "\n" + str([(i["id"], i["examples"]) for i in catalog["intents"]])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _normalize(matrix):
    norms = np.linalg.norm(matrix, axis=-1, keepdims=True)
    return matrix / np.where(norms == 0, 1, norms)


async def _embed_with_retry(texts, log):
    # The free Gemini plan allows only so many a minute: wait and try again.
    for attempt in range(6):
        try:
            return await ollama.embed(texts)
        except ollama.OllamaDown as error:
            if "429" not in str(error) or attempt == 5:
                raise
            log("Embedding limit reached — waiting 30 s…")
            await asyncio.sleep(30)
    return []


class IntentIndex:
    def __init__(self):
        self.vectors = None   # (examples × numbers), each row of length 1
        self.intents = []     # the action of each row
        self.documents = []   # the example sentence of each row

    def _cache_file(self):
        return config.INDEX_DIR / f"{config.EMBED_MODEL.replace('/', '_').replace(':', '_')}.npz"

    def _read_cache(self):
        """(meta, vectors) from the saved file, or (None, None)."""
        path = self._cache_file()
        if not path.exists():
            return None, None
        try:
            with np.load(path, allow_pickle=False) as data:
                return json.loads(str(data["meta"])), data["vectors"].astype(np.float32)
        except (OSError, KeyError, ValueError):
            return None, None

    def _load(self, wanted):
        meta, vectors = self._read_cache()
        if meta is None or meta.get("catalog_hash") != wanted or len(meta["intents"]) != len(vectors):
            return False
        self.vectors = _normalize(vectors)
        self.intents = meta["intents"]
        self.documents = meta["documents"]
        return True

    def _save(self, wanted):
        config.INDEX_DIR.mkdir(parents=True, exist_ok=True)
        meta = json.dumps({"catalog_hash": wanted, "intents": self.intents, "documents": self.documents}, ensure_ascii=False)
        # float16 is plenty for cosine similarity and halves the file.
        np.savez_compressed(self._cache_file(), vectors=self.vectors.astype(np.float16), meta=np.array(meta))

    async def build(self, catalog, log):
        """Loads the saved index, or re-embeds every example if the catalog changed."""
        wanted = catalog_hash(catalog)
        if self._load(wanted):
            log(f"Vector index loaded ({len(self.intents)} example sentences).")
            return

        intents, documents = [], []
        for intent in catalog["intents"]:
            for example in intent["examples"]:
                intents.append(intent["id"])
                documents.append(example)
        # Sentences already in the saved file (same model) keep their numbers;
        # only new or changed ones are embedded — the free Gemini plan counts
        # every sentence.
        meta, old_vectors = self._read_cache()
        known = dict(zip(meta["documents"], old_vectors)) if meta and len(meta["documents"]) == len(old_vectors) else {}
        missing = list(dict.fromkeys(doc for doc in documents if doc not in known))
        log(f"Building the vector index: {len(documents)} example sentences, {len(missing)} to embed…")
        for start in range(0, len(missing), BATCH):
            batch = missing[start:start + BATCH]
            known.update(zip(batch, np.asarray(await _embed_with_retry(batch, log), dtype=np.float32)))
        self.vectors = _normalize(np.stack([known[doc] for doc in documents]))
        self.intents, self.documents = intents, documents
        self._save(wanted)
        log(f"Vector index ready ({len(documents)} example sentences).")

    def nearest(self, embedding, k):
        """The k stored examples closest to `embedding`: [(intent, similarity, example)]."""
        query = _normalize(np.asarray(embedding, dtype=np.float32))
        similarities = self.vectors @ query
        k = min(k, len(similarities))
        top = np.argpartition(-similarities, k - 1)[:k]
        top = top[np.argsort(-similarities[top])]
        return [(self.intents[i], float(similarities[i]), self.documents[i]) for i in top]

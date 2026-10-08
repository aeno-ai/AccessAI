"""The vector database: Accel's memory of example sentences.

How it works, in plain words:
  1. intents.json lists every action Accel can do, each with example
     sentences ("take me to conversation mode", "gusto kong makipag-usap"…).
  2. Each example is turned into an EMBEDDING — 1024 numbers that capture
     its meaning (by the bge-m3 model in Ollama). Sentences that mean similar
     things get similar numbers, even in different words or languages.
  3. ChromaDB (a vector database) stores those numbers on disk in ai/.chroma
     and can quickly find which stored examples are CLOSEST to a new
     sentence. "Closest" = cosine similarity: 1.0 is the same direction
     (same meaning), 0 is unrelated.
  4. When someone talks to Accel, their sentence is embedded the same way
     and the nearest examples tell us which action they most likely mean.

The index is rebuilt automatically whenever intents.json (or the embedding
model) changes — just edit the JSON and restart.
"""
import hashlib
import logging

from . import config, ollama

logging.getLogger("chromadb").setLevel(logging.ERROR)

COLLECTION = "intent_examples"


def catalog_hash(catalog):
    text = config.EMBED_MODEL + "\n" + str([(i["id"], i["examples"]) for i in catalog["intents"]])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


class IntentIndex:
    def __init__(self):
        import chromadb
        from chromadb.config import Settings

        self.client = chromadb.PersistentClient(
            path=str(config.CHROMA_DIR), settings=Settings(anonymized_telemetry=False)
        )
        self.collection = None

    async def build(self, catalog, log):
        """Loads the stored index, or re-embeds every example if the catalog changed."""
        wanted = catalog_hash(catalog)
        existing = None
        try:
            existing = self.client.get_collection(COLLECTION)
        except Exception:  # noqa: BLE001 — not created yet
            existing = None
        if existing is not None and (existing.metadata or {}).get("catalog_hash") == wanted:
            self.collection = existing
            log(f"Vector index loaded ({existing.count()} example sentences).")
            return
        if existing is not None:
            self.client.delete_collection(COLLECTION)

        ids, documents, metadatas = [], [], []
        for intent in catalog["intents"]:
            for n, example in enumerate(intent["examples"]):
                ids.append(f"{intent['id']}#{n}")
                documents.append(example)
                metadatas.append({"intent": intent["id"]})
        log(f"Building the vector index: embedding {len(documents)} example sentences…")
        embeddings = []
        for start in range(0, len(documents), 32):
            embeddings.extend(await ollama.embed(documents[start:start + 32]))
        # cosine = compare directions (meaning), not lengths. We give Chroma the
        # embeddings ourselves, so it never needs its own embedding model.
        self.collection = self.client.create_collection(
            COLLECTION, metadata={"hnsw:space": "cosine", "catalog_hash": wanted}, embedding_function=None
        )
        self.collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
        log(f"Vector index ready ({len(documents)} example sentences).")

    def _query(self, embedding, k):
        return self.collection.query(
            query_embeddings=[embedding], n_results=k, include=["metadatas", "distances", "documents"]
        )

    def nearest(self, embedding, k):
        """The k stored examples closest to `embedding`: [(intent, similarity, example)]."""
        try:
            result = self._query(embedding, k)
        except Exception:  # noqa: BLE001
            # Another process (e.g. `python -m app.eval` after intents.json
            # changed) rebuilt the index while this one was running: re-open it.
            self.collection = self.client.get_collection(COLLECTION)
            result = self._query(embedding, k)
        hits = []
        for meta, distance, document in zip(result["metadatas"][0], result["distances"][0], result["documents"][0]):
            # Chroma reports cosine DISTANCE (0 = identical); similarity = 1 − distance.
            hits.append((meta["intent"], 1.0 - float(distance), document))
        return hits

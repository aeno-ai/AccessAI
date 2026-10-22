# How AccessAI scales

*For the defense. Built and measured 2026-10-21 (HANDOFF.md §52). Every number below comes from a real run on the team laptop (Intel Core Ultra 5, 10 cores) against our real MongoDB Atlas database.*

## The short version (what to say)

> AccessAI's backend can run as **several identical copies at once**, and they behave like one server. Anything a copy needs to remember — who is connected, how many requests someone made, which copy runs the timed jobs — is kept in **MongoDB Atlas**, which we already use, instead of inside one copy. So we can add copies (on one computer or many) to serve more users, and losing one copy doesn't lose anyone's data. Sign-language reading already runs **on each user's phone**, so it grows with the number of phones, not with our server. For analysing logs at large scale we added an **Apache Spark** job, which processed **970,000 log records in about 20 seconds** on one laptop. Our load test showed the next bottleneck honestly: the **free database tier**, which is the next thing to upgrade.

## Before and after

```
BEFORE (one copy)                          AFTER (any number of copies)

 phones ──► [ backend ]                     phones ──► load balancer / Node cluster
              │  remembers in its own                   │         │         │
              │  memory: live connections,         [copy 1]  [copy 2]  [copy N]
              │  rate limits, timed jobs                 \        |        /
              ▼                                           ▼       ▼       ▼
          MongoDB Atlas                              MongoDB Atlas (3-node replica set)
                                                      · users, chats, SOS, logs (as before)
 A second copy would not see the first               · live-connection events  (socket_io_events)
 one's connections, would count limits                · rate-limit counters     (rate_buckets, rate_counters)
 separately, and would run every job twice.           · job leases              (job_leases)
```

## What we changed (and where)

| Problem with several copies | What we did | Where |
|---|---|---|
| A chat message or SOS sent through copy B never reached a phone connected to copy A. | Live connections are shared through MongoDB with the official Socket.IO MongoDB adapter. "Is this friend online?" and "close this account's connections" ask every copy. | `backend/src/realtime/io.js` (`SOCKET_ADAPTER=mongo`) |
| Each copy counted rate limits on its own, so 2 copies allowed twice the requests. | Rate limits are counted in MongoDB. The token bucket (120 at once, 2 per second) runs as **one atomic database update**, so two copies can't both spend the last token. | `backend/src/middleware/sharedRateStores.js` (`RATE_LIMIT_STORE=mongo`) |
| Every copy ran the hourly clean-up and the SOS expiry, so the jobs ran N times. | Each job has a **lease** in MongoDB: only the copy holding it runs the job; if that copy dies, another takes over when the lease runs out. | `backend/src/utils/jobLease.js` |
| Nothing could start several copies. | `npm run start:cluster` starts `CLUSTER_WORKERS` copies (default 2) on one port and restarts any that crash. | `backend/src/cluster.js` |
| Behind a load balancer on another machine, all users would look like one address. | `TRUST_PROXY` setting (default unchanged). | `backend/src/app.js` |
| A copy that is shutting down kept receiving new requests. | `/api/health` answers 503 "draining" while a copy shuts down, so a load balancer stops sending it requests. | `backend/src/app.js`, `server.js` |
| Dashboard date queries would slow down as data grows. | Indexes on the date fields used by the dashboard and Suspicious Activities. | the models in `backend/src/models/` |

**Nothing changes by default.** `npm run dev` and `npm start` still run one copy exactly as before; the shared modes switch on only with `npm run start:cluster` (or the two settings above).

The phone app needs no change: its live connection is WebSocket-only, so it doesn't matter which copy it lands on (no "sticky sessions"), and logins are signed tokens that any copy can check.

## Proof (run it yourself)

```
cd backend
npm run scale-check        # starts 2 copies on ports 3201 and 3202 and checks them (about 30 s)
npm run load-test          # 1 copy vs 2 copies under load (about 1 minute)
npm run start:cluster      # run 2 copies for real (Ctrl+C stops them)

npm run export-logs        # logs → analytics/data (no names, emails, addresses or locations)
cd ../analytics
.venv\Scripts\python spark_job.py --scale 10000
```

### `npm run scale-check` — 5 / 5 passed

| Check | Result |
|---|---|
| A chat message sent through copy B reaches a phone connected to copy A | ✓ |
| Copy B shows that friend as online (her phone is on copy A) | ✓ |
| A burst of 130 requests from one person, split over both copies, is limited as **one** person | ✓ 122 passed, 8 slowed down (not 130) |
| Each timed job is held by exactly one copy | ✓ |
| An admin suspending someone through copy B closes their connection on copy A | ✓ |

### `npm run load-test` — what limits us today

A real signed-in request (`GET /api/friends/me`: token check + database), 50 at a time for 12 seconds:

| Setup | Requests / second | Typical response (p50) | Slowest 1% (p99) | Errors |
|---|---|---|---|---|
| 1 copy | 39 | 1.12 s | 2.20 s | 0 |
| 2 copies (shared through MongoDB) | 34 | 1.22 s | 2.28 s | 0 |

**What this means:** a second copy did **not** add speed, because the servers are not the bottleneck — the database is. We measured it directly:

- one database round trip from the laptop to Atlas: **about 100 ms** (61–145 ms);
- 40 database requests at once: **1.6 s** — our **free Atlas tier (M0)** limits how much work it does at once.

So the next step to serve more users is the database, not the code: move to a paid Atlas tier in a nearby region (more connections and CPU, lower latency), then add servers. The shared mode adds one small database update per request (the rate limit), which is why 2 copies were slightly slower here; on a faster database tier near us that cost should shrink to a few milliseconds (not measured yet).

### Spark log analytics

The admin dashboard asks MongoDB for live numbers, which is right at our size. For much larger log volumes we added an **Apache Spark** job (`analytics/spark_job.py`): it reads the exported logs and computes logins per day, **consecutive failed logins** (with Spark window functions — the same rule as Suspicious Activities), the busiest hours, how fast friends answer an SOS, and limits hit.

| Log records | Time (10 cores, one laptop) |
|---|---|
| 97 (our real logs) | 14.5 s |
| 9,700 (×100) | 16.5 s |
| 970,000 (×10,000) | 20.4 s |

Most of the 14 seconds is Spark starting up; **10,000 times more data cost about 6 more seconds.** On a real Spark cluster the same script runs across many machines (only the `master` setting changes).

## The 10× and 100× story

| Growth | What happens | What we do |
|---|---|---|
| **10×** users and data | Fits in the current design. The dashboard's date queries use indexes; sign reading is on the phones. | Paid Atlas tier near the Philippines; `npm run start:cluster` on one stronger server. |
| **100×** | One server is not enough; logs grow into the millions. | Several servers behind a load balancer, all in shared mode (already built); Atlas scaled up (and sharded later); log analytics with the Spark job on a cluster; the AI service on its own machine (it already runs separately). |

## Why these choices (likely questions)

- **"Why not use Spark for the whole system?"** Spark is for *analysing* very large amounts of data in batches, not for answering a phone in milliseconds. So the app uses MongoDB for live work and Spark only for heavy log analytics.
- **"Why MongoDB for the shared state and not Redis?"** Redis is the textbook choice and is faster, but it is another server to run and pay for. We already have MongoDB Atlas (a 3-node replica set, which the Socket.IO adapter needs), so we used it and added no new service. Swapping in Redis later only changes these small modules.
- **"What if one copy crashes?"** The cluster starts a new one; phones reconnect to any copy; no data was only in that copy; its job lease runs out and another copy takes over the jobs.
- **"What about the AI?"** Sign reading now runs on each phone (it scales with users for free). Laya's AI service is separate from the backend, so it can move to its own (GPU) machine without touching the backend.
- **"Is this tested?"** Yes: `scale-check` (5/5 with two real copies), the full backend test suite (241/241 in normal mode), and the load test above.

## Not done (honest limits)

- Not deployed on several real machines yet — demonstrated with copies on one laptop.
- The load test shows the free database tier as the limit; we haven't paid for a bigger one.
- The AI service still runs as one copy (its sign sessions are no longer used by the app; Laya's AI could be given its own machine).

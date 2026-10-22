# Deploying AccessAI on Oracle Cloud "Always Free"

*HANDOFF.md §53. Everything below is free on Oracle's Always Free tier and MongoDB Atlas M0. Free-tier rules change — check Oracle's current Always Free page before you start.*

## What you get

```
 phones (APK) ─┐                    Oracle Always Free VM (Ubuntu 24.04, ARM, 4 cores / 24 GB)
 admin browser ┼─► https://YOU.duckdns.org ─► Caddy (HTTPS, free certificate)
               │                               ├─ /api, /socket.io ─► backend × 4 copies (npm run start:cluster)
               │                               │                         └─► AI service (Laya) ─► Ollama
               │                               └─ everything else  ─► admin website (built files)
               │
 landing page ─┴─ Vercel (as before)            MongoDB Atlas M0 (as before): data + the shared
                                                connections, rate limits and job leases
```

- The backend runs as **4 copies** sharing through Atlas — the scalability design, running for real.
- Laya's AI (sentences, English translation) runs on the VM with Ollama — slower than the laptop on ARM CPUs, but it works.
- Sign language is read on the phones, so the server needs no sign-language software.
- The admin website and the API share **one address**, which the admin login cookie needs.
- Tailscale is no longer needed.

## Before you start (on your laptop)

- Your laptop's `backend/.env` (you'll copy its values).
- A GitHub account with access to the repo.
- An SSH key: in PowerShell, `ssh-keygen -t ed25519` (press Enter to accept the defaults). The public key is `C:\Users\<you>\.ssh\id_ed25519.pub`.

## 1. Create the server (Oracle Cloud console)

1. Sign up at **cloud.oracle.com** (a card is asked for to verify you; Always Free resources are not charged). Pick a home region near the Philippines (e.g. Singapore) — it can't be changed later.
2. **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Ampere → VM.Standard.A1.Flex**, **4 OCPUs, 24 GB memory** (the Always Free limit).
   - Networking: create a new VCN with a **public subnet**, and **assign a public IPv4 address**.
   - SSH keys: paste your `id_ed25519.pub`.
   - Create. If it says "Out of capacity", try another availability domain or try again later — common on the free tier.
3. **Open the web ports:** Networking → Virtual cloud networks → your VCN → Security Lists → Default → **Add Ingress Rules**: source `0.0.0.0/0`, TCP, destination port **80**; and again for **443**.
4. Note the instance's **public IP address**. (Optional but better: make it a reserved IP, so it never changes.)

## 2. A free web address (DuckDNS)

1. Sign in at **duckdns.org**, create a subdomain (e.g. `accessai-group4`), and set its IP to the server's public IP.
2. Your address is now `accessai-group4.duckdns.org` — used as `YOUR-NAME.duckdns.org` below.

## 3. Outside services

- **MongoDB Atlas → Network Access → Add IP Address:** the server's public IP.
- **Google Cloud Console → APIs & Services → Credentials →** your OAuth client → **Authorized redirect URIs → add** `https://YOUR-NAME.duckdns.org/api/auth/google/callback`.

## 4. Put the code on the server

From PowerShell on your laptop:

```
ssh ubuntu@SERVER-IP
```

On the server:

```
git clone https://github.com/aeno-ai/AccessAI.git
cd AccessAI
```

The repo is private, so git asks for a username and a password: use your GitHub username and a **personal access token** (GitHub → Settings → Developer settings → Fine-grained tokens → read access to this repo) as the password.

## 5. The server's settings (backend/.env)

```
cp deploy/oracle/backend.env.example backend/.env
nano backend/.env
```

Fill it in: copy the values from your laptop's `backend/.env`, and set the "NEW on the server" lines (your DuckDNS address in `BACKEND_PUBLIC_URL` and `ALLOWED_ORIGINS`). Save with Ctrl+O, Enter, Ctrl+X. Never commit this file.

## 6. Install and start everything

```
bash deploy/oracle/setup.sh YOUR-NAME.duckdns.org
```

It takes 15–30 minutes the first time (packages, then about 3 GB of AI models). It installs Node.js 24, Caddy, Ollama and Python packages, opens ports 80/443 in the server's own firewall, builds the admin website, and starts three services that also start at every reboot.

## 7. Check it

- `https://YOUR-NAME.duckdns.org/api/health` → `{"status":"ok","database":true,"ai":true}` (`ai` turns true after Ollama has loaded, a minute or two after start).
- `https://YOUR-NAME.duckdns.org/` → the admin login page. Log in with your admin account.
- The 4 copies: `journalctl -u accessai-backend -n 50` shows "Starting 4 server copies…" and "Realtime: shared across server copies through MongoDB".
- Email codes: the same log shows `[mail] Gmail login OK`. If it says the login failed, check `SMTP_*` (Gmail needs an app password).

## 8. Point the app at the server

On your laptop, in `frontend/.env`, make this the one active line:

```
EXPO_PUBLIC_API_URL=https://YOUR-NAME.duckdns.org/api
```

Then build a new APK (`eas build --profile preview --platform android`, or a development build). The address is built into the APK, so every phone that installs it uses the server — no more laptop needed. Put the APK link in `landing/site.config.ts` (`androidApkUrl`).

## Later: updating the server

After you push new code to GitHub:

```
ssh ubuntu@SERVER-IP
cd AccessAI && bash deploy/oracle/update.sh
```

## Useful commands (on the server)

| What | Command |
|---|---|
| Live logs of the backend / AI / HTTPS | `journalctl -u accessai-backend -f` / `-u accessai-ai -f` / `-u caddy -f` |
| Restart the backend | `sudo systemctl restart accessai-backend` |
| Status of everything | `systemctl status accessai-backend accessai-ai ollama caddy` |
| Prove the copies share (scalability demo) | `cd ~/AccessAI/backend && npm ci && npm run scale-check` |
| Memory and CPU | `htop` (install with `sudo apt install htop`) |

## Good to know

- **Always Free can be reclaimed if idle.** Oracle may stop Always Free VMs that stay almost idle for about a week. Upgrading the account to "Pay As You Go" keeps the free resources free and avoids this; using the app regularly also helps. Check Oracle's current policy.
- **The database is still the limit.** Our load test showed the free Atlas M0 tier, not the server, limits speed (docs/SCALABILITY.md). A paid Atlas tier in Singapore is the next upgrade if many people use it.
- **Laya on ARM is slower:** commands the phone understands by itself stay instant; ones that need the AI take a few seconds longer than on the laptop.
- **If a Python package fails to install** on ARM (step 6), copy the error to Claude — `ai/requirements-server.txt` may need a version change.
- **Rolling back:** the laptop setup (Tailscale) still works; point `EXPO_PUBLIC_API_URL` back to it.

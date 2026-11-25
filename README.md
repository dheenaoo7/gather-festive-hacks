# Gather (dummy build)

Setup check for the Festive Hacks app: Next.js 16 + React 19 + SQLite (Node's built-in `node:sqlite`). The UI is a placeholder until the real design lands.

## Run

Requires Node 24+.

```bash
npm install
npm test          # store rules: RSVP counted once, totals-only for host/assigned vendors
npm run dev       # http://127.0.0.1:3000 (this Mac only)
npm run dev:lan   # reachable from a phone on the same Wi-Fi: http://<mac-ip>:3000
```

Data lives in `.data/gather.sqlite` (git-ignored). Delete it to reset the seeded demo.

## What exists

- Demo sign-in with seeded accounts (guest, uninvited guest, host, assigned photographer and caterer, unassigned videographer).
- Event page: guests RSVP; host and assigned vendors see totals only; host sees the invitation QR.
- `GET /api/health`, `GET /api/events/:id` (same role filter as the page).

AI coding assistants were used to build this project.

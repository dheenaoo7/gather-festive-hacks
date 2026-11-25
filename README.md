# Gather (dummy build)

Setup check for the Festive Hacks app: Next.js 16 + React 19 + SQLite (Node's built-in `node:sqlite`). The UI is a placeholder until the real design lands.

## Run

Requires Node 24+.

```bash
npm install
npm test          # store rules: RSVP counted once, totals-only for host/assigned vendors
npm run dev       # http://127.0.0.1:3100 (this Mac only)
```

### Test on a phone (Cloudflare quick tunnel, HTTPS)

```bash
npm run build && npm start             # terminal 1: app on 127.0.0.1:3100 only
npm run tunnel                         # terminal 2: prints https://<random>.trycloudflare.com
# restart terminal 1 with the printed URL so the invitation QR points at it:
PUBLIC_URL=https://<random>.trycloudflare.com npm start
```

The quick-tunnel URL changes every time `cloudflared` restarts and is public: anyone with the link can use the demo sign-in. Use seeded data only. HTTPS through the tunnel is what lets phone browsers allow location for check-in.

Data lives in `.data/gather.sqlite` (git-ignored). Delete it to reset the seeded demo.

## What exists

- Demo sign-in with seeded accounts (guest, uninvited guest, host, assigned photographer and caterer, unassigned videographer).
- Event page: guests RSVP; host and assigned vendors see totals only; host sees the invitation QR.
- `GET /api/health`, `GET /api/events/:id` (same role filter as the page).

AI coding assistants were used to build this project.

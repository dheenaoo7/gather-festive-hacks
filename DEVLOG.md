# Gather — Devlog & Build Notes (Festive Hacks)

quick rundown of what we built for festive hacks before hitting the deadline wall.

## what is gather
privacy-first festive event app. instead of spamming giant guest lists or tracking exact locations, hosts get aggregate numbers only. guests get clean flows for checkin, food batches, and photos without their data leaking everywhere.

## what got done

### 1. multi-role event desks & calendar
- built dedicated views per role: guest, host, photographer, caterer, and decorator.
- calendar view split into attending, hosting, co-hosting, and vending so users can jump straight to their desk.
- host desk shows live aggregate counters: rsvp counts, actual check-ins, queue depths.

### 2. sponsor integrations
- **Flagsmith:** remote feature toggles for operational desks (`module_photo_queue`, `module_food_queue`, `module_voice_calls`). lets hosts toggle modules on the fly without touching code or redeploying.
- **Sarvam AI & Bolna:** automated voice agent for rsvp follow-up calls in regional languages (tamil, hindi, english). host triggers call, guest answers if they're coming or running late, and the result directly updates aggregate counts.
- **NudgeBee:** used cli tooling (`nbctl`) and operational checks for queue health and diagnostics.

### 3. guest flow & privacy guardrails
- zero coordinate storage. check-in works via one-tap location match or fallback venue code.
- photo booth queue tracks active shooting vs paused time down to the second. photos go into private batches and unlock strictly in after-event for guests in that batch.
- food opt-ins call guests in small batches to keep dining counters crowd-free.

## stack
- next.js 16 (app router + turbopack)
- react 19
- sqlite via node's built-in `node:sqlite`
- cloudflare quick tunnel for mobile testing

built under time crunch. didn't manage to record a polished video before 5pm sharp, but the core architecture, sponsor integrations, and role desks are all committed and verified.

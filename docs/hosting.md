# Hosting Recommendations & Free-Tier Constraints

Stated plainly so expectations are calibrated.

## Recommended (free, end-to-end)

- **Frontend:** Vercel (or Netlify) free tier — HTTPS by default, ample for this
  SPA + light serverless usage. Monthly bandwidth/build limits apply.
- **Backend:** Supabase free tier — Postgres + Auth + Storage + Realtime + Edge
  Functions + RLS in one place.

## Supabase free-tier limits (approximate)

- **~500 MB** Postgres database.
- **~1 GB** Storage.
- Project **pauses after ~1 week of inactivity** (resume from the dashboard).
- Limited monthly Edge Function invocations / Realtime messages.

**Implications for this app:**
- Selfies (Phase 2) and especially **screenshots (Phase 19)** consume Storage
  fast. Mitigate with image **compression**, **retention limits / auto-pruning**,
  and a documented **upgrade path**. Configure capture interval conservatively.
- For a real org, budget for the Supabase Pro tier once storage/DB grow.

## Email / notifications

- **In-app** notifications are free via Supabase Realtime.
- **Email** (password resets, offer letters, alerts) needs an SMTP/transactional
  provider (e.g. Resend/SendGrid free tier) configured in Supabase Auth settings.
  Each provider has monthly send limits — document and monitor them.

## Hard platform limitations (not faked)

- **WiFi SSID validation is impossible from a web app** — browsers cannot read
  the SSID. Attendance uses **GPS** as the primary gate, with an optional admin
  IP-allowlist. True SSID checks require a native agent (out of scope). (Phase 2)
- **Background screenshot monitoring is impossible from a web browser** — screen
  capture requires explicit per-session user consent and cannot run silently on a
  timer. We implement the feasible **opt-in** capture and expose a configurable
  interval that a future **native desktop agent** would consume. (Phase 19)

## Scope note

The full 30-module vision is far larger than a small budget/timeline supports.
The phased plan ships the **Core system (Phases 0–9)** as standalone value first;
Extended modules (10–19) are added incrementally and are best treated as priced
add-ons.

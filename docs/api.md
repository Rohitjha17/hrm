# API & Function Documentation

The frontend talks to Postgres through Supabase's auto-generated REST/Realtime
APIs (RLS-enforced) plus a small set of **RPCs** (SQL functions) and **Edge
Functions** (Deno) for privileged server-side logic.

## RPCs (Postgres functions)

### `health_check() → text`
- **Auth:** `anon`, `authenticated`.
- **Returns:** `'ok'`.
- **Use:** connectivity probe for the app health badge and the e2e smoke test.

```ts
const { data, error } = await supabase.rpc('health_check') // 'ok'
```

### `has_permission(perm text) → boolean`
- **Auth:** authenticated. **SECURITY DEFINER** (bypasses RLS to avoid policy
  recursion). True if the caller holds `perm` or the `'*'` wildcard.

### `my_permissions() → text[]`
- **Auth:** authenticated. All effective permission keys for the caller. The
  frontend builds UI guards from this (`'*'` ⇒ all).

### `my_roles() → text[]`
- **Auth:** authenticated. Role slugs held by the caller (e.g. `['employee',
  'super_admin']`) — drives the dual-view toggle.

### `attendance_punch(p_type, p_lat, p_lng, p_selfie_path?, p_ip?) → jsonb`
- **Auth:** authenticated. **SECURITY DEFINER.** Validates the punch is within
  the configured radius (haversine, server-side) and that the in/out sequence is
  valid, records the punch, and recomputes the day.
- **Returns:** `{ ok: true, punch_type, distance_m, work_date, status,
  worked_minutes, is_late, overtime_minutes }` or `{ ok: false, reason }` where
  reason ∈ `out_of_radius | ip_not_allowed | already_punched_in | not_punched_in`.

```ts
const { data } = await supabase.rpc('attendance_punch', {
  p_type: 'in', p_lat: 22.745618, p_lng: 75.8933851, p_selfie_path: 'uid/2026-06-16/x.jpg',
})
```

### `recompute_attendance_day(p_user, p_date)` — service-role only
- The working-hours engine. Pairs in/out punches, sums worked minutes, derives
  `status` (full/half/quarter/absent) from configurable thresholds, plus
  `is_late` and `overtime_minutes`.

> **Platform note:** WiFi SSID validation is impossible from a web browser, so
> attendance uses GPS as the primary gate plus an optional admin IP allowlist.

More RPCs are documented here as they are added (planning compliance, salary
calc inputs, etc.).

## Edge Functions (Deno)

None yet. Added from **Phase 6** for logic that must not run in the client:

- `calculate-salary` — policy-driven monthly salary (Phase 6).
- `full-final-settlement` — F&F on exit (Phase 15/16).
- document generation, and other privileged operations.

Each Edge Function will document: route, method, auth/permission required,
request schema (Zod), response schema, and side effects.

## Conventions

- All request bodies validated with **Zod** at the boundary.
- Permission checks happen **server-side** (in the function and via RLS), never
  trusting the client.
- Errors return a consistent `{ error: string }` shape with an appropriate
  HTTP status.

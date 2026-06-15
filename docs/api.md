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

More RPCs are documented here as they are added (attendance hours engine,
planning compliance, salary calc inputs, etc.).

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

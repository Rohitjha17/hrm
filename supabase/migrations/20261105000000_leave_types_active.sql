-- Centralized Masters needs leave_types to carry the standard shape
-- (is_active for the common widget). Existing rows are activated by default.
alter table public.leave_types
  add column if not exists is_active boolean not null default true;

-- Requirement 72: customizable salary-slip templates and branding.
create table if not exists public.payslip_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  letterhead text,
  logo_url text,
  body_template text not null default 'Pay period: {{month}}\nGross: {{gross}}\nNet: {{net}}\nEarnings: {{earnings}}\nDeductions: {{deductions}}',
  footer text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.payslip_templates (name, letterhead, is_default)
values ('Standard', 'Salary Slip', true) on conflict (name) do nothing;
create trigger trg_payslip_templates_updated before update on public.payslip_templates
  for each row execute function public.set_updated_at();
alter table public.payslip_templates enable row level security;
create policy payslip_templates_select on public.payslip_templates for select to authenticated using (true);
create policy payslip_templates_write on public.payslip_templates for all to authenticated
  using (public.has_permission('salary.manage')) with check (public.has_permission('salary.manage'));


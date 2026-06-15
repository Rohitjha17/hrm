// Named seed users (single source of truth for the seed script AND e2e tests).
//
// ⚠️ LOCAL / TEST credentials only — these provision demo accounts on a local or
// disposable test database. They are NOT shown anywhere in the app UI (hard
// requirement #3). In production, an admin provisions real accounts and sets
// passwords out-of-band; never reuse these.
//
// Per the spec, these names/roles are seed EXAMPLES — change freely or add more
// users via the UI without code changes.

export const SEED_USERS = [
  {
    email: 'sunil@hrms.local',
    password: 'Sunil#Demo2026',
    fullName: 'Sunil Sharma',
    employeeCode: 'EMP001',
    department: 'Engineering',
    team: 'Platform',
    roles: ['employee', 'super_admin'], // dual access: Employee + Super Admin
  },
  {
    email: 'riya@hrms.local',
    password: 'Riya#Demo2026',
    fullName: 'Riya Verma',
    employeeCode: 'EMP002',
    department: 'Human Resources',
    team: 'HR Ops',
    roles: ['employee', 'super_admin'], // dual access: Employee + Super Admin
  },
  {
    email: 'aarti@hrms.local',
    password: 'Aarti#Demo2026',
    fullName: 'Aarti Patel',
    employeeCode: 'EMP003',
    department: 'Engineering',
    team: 'Platform',
    roles: ['employee'],
    reportsTo: 'sunil@hrms.local',
  },
  {
    email: 'raj@hrms.local',
    password: 'Raj#Demo2026',
    fullName: 'Raj Singh',
    employeeCode: 'EMP004',
    department: 'Sales',
    team: 'Field Sales',
    roles: ['employee'],
    reportsTo: 'riya@hrms.local',
  },
]

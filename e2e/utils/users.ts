// Single source of truth shared with the seed script (scripts/seed-users.mjs).
import { SEED_USERS } from '../../scripts/seed-users.mjs'

export interface SeedUser {
  email: string
  password: string
  fullName: string
  employeeCode: string
  department: string
  team: string
  roles: string[]
  reportsTo?: string
}

export const USERS = SEED_USERS as SeedUser[]

function byEmailPrefix(prefix: string): SeedUser {
  const u = USERS.find((x) => x.email.startsWith(prefix))
  if (!u) throw new Error(`Seed user not found: ${prefix}`)
  return u
}

export const sunil = byEmailPrefix('sunil') // Employee + Super Admin
export const riya = byEmailPrefix('riya') // Employee + Super Admin
export const aarti = byEmailPrefix('aarti') // Employee only
export const raj = byEmailPrefix('raj') // Employee only

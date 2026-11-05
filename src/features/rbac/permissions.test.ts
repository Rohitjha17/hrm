import { describe, expect, it } from 'vitest'
import { hasEffectivePermission } from './permissions'

describe('hasEffectivePermission', () => {
  it('keeps wildcard and exact grants', () => {
    expect(hasEffectivePermission(new Set(['*']), 'salary.delete')).toBe(true)
    expect(hasEffectivePermission(new Set(['tasks.edit']), 'tasks.edit')).toBe(true)
  })

  it('lets a legacy manage grant cover action permissions', () => {
    const permissions = new Set(['helpdesk.manage'])
    expect(hasEffectivePermission(permissions, 'helpdesk.view')).toBe(true)
    expect(hasEffectivePermission(permissions, 'helpdesk.add')).toBe(true)
    expect(hasEffectivePermission(permissions, 'helpdesk.edit')).toBe(true)
    expect(hasEffectivePermission(permissions, 'helpdesk.delete')).toBe(true)
  })

  it('does not let one action grant expand into another action', () => {
    const permissions = new Set(['documents.view'])
    expect(hasEffectivePermission(permissions, 'documents.view')).toBe(true)
    expect(hasEffectivePermission(permissions, 'documents.add')).toBe(false)
    expect(hasEffectivePermission(permissions, 'documents.edit')).toBe(false)
    expect(hasEffectivePermission(permissions, 'documents.delete')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  moveSidebarItem,
  moveSidebarItemBy,
  normalizeSidebarPreferences,
} from './sidebar-preferences'

describe('sidebar preferences', () => {
  it('keeps saved order, removes stale ids, and appends new modules', () => {
    expect(
      normalizeSidebarPreferences(['dashboard', 'tasks', 'leave'], {
        order: ['tasks', 'removed', 'dashboard', 'tasks'],
        hidden: ['leave', 'removed', 'leave'],
        collapsed: true,
      }),
    ).toEqual({
      order: ['tasks', 'dashboard', 'leave'],
      hidden: ['leave'],
      collapsed: true,
      collapsedGroups: [],
    })
  })

  it('moves an item by drag target or one keyboard step', () => {
    expect(moveSidebarItem(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveSidebarItemBy(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveSidebarItemBy(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  })
})

const ACTIONS = new Set(['view', 'add', 'edit', 'delete'])

/**
 * Resolve a permission while preserving roles created before action-level
 * permissions existed. A legacy `<module>.manage` grant covers all four
 * actions; an action grant never expands to another action.
 */
export function hasEffectivePermission(permissions: Set<string>, permission: string) {
  if (permissions.has('*') || permissions.has(permission)) return true
  const separator = permission.lastIndexOf('.')
  if (separator < 1) return false
  const module = permission.slice(0, separator)
  const action = permission.slice(separator + 1)
  return ACTIONS.has(action) && permissions.has(`${module}.manage`)
}

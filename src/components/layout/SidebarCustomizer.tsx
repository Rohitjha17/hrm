import { useMemo, useState } from 'react'
import {
  ArrowDownAZ,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  PanelLeftClose,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  moveSidebarItem,
  moveSidebarItemBy,
  normalizeSidebarPreferences,
  type SidebarPreferences,
} from './sidebar-preferences'
import { sidebarGroupsFor } from './sidebar-groups'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export interface CustomizableSidebarItem {
  id: string
  label: string
  icon: LucideIcon
  group?: string
}

/**
 * Grouped sidebar customizer: shows items under their group header, with per-
 * item reorder/hide and a per-group collapse toggle (persisted via prefs so
 * the sidebar remembers which sections the user wants shut).
 */
export function SidebarCustomizer({
  open,
  mode = 'admin',
  items,
  value,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  mode?: 'admin' | 'employee'
  items: CustomizableSidebarItem[]
  value: SidebarPreferences
  saving: boolean
  onClose: () => void
  onSave: (value: SidebarPreferences) => void
}) {
  const ids = items.map((item) => item.id)
  const [draft, setDraft] = useState(() => normalizeSidebarPreferences(ids, value))
  const [dragging, setDragging] = useState<string | null>(null)

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const ordered = draft.order
    .map((id) => byId.get(id))
    .filter(Boolean) as CustomizableSidebarItem[]
  const hidden = new Set(draft.hidden)
  const groupsCollapsed = new Set(draft.collapsedGroups)

  const groups = useMemo(() => {
    const defs = [...sidebarGroupsFor(mode), { id: 'other', label: 'Other' }]
    const map = new Map<string, CustomizableSidebarItem[]>()
    for (const item of ordered) {
      const key = item.group ?? 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return defs
      .map((def) => ({ ...def, items: map.get(def.id) ?? [] }))
      .filter((group) => group.items.length > 0)
  }, [ordered, mode])

  function toggle(id: string) {
    setDraft((current) => ({
      ...current,
      hidden: current.hidden.includes(id)
        ? current.hidden.filter((itemId) => itemId !== id)
        : [...current.hidden, id],
    }))
  }

  function toggleGroup(groupId: string) {
    setDraft((current) => ({
      ...current,
      collapsedGroups: current.collapsedGroups.includes(groupId)
        ? current.collapsedGroups.filter((id) => id !== groupId)
        : [...current.collapsedGroups, groupId],
    }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Customize sidebar" testid="sidebar-customizer">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Compact sidebar</p>
            <p className="text-xs text-slate-500">Show icons only on larger screens.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.collapsed}
            data-testid="sidebar-compact-toggle"
            onClick={() => setDraft((current) => ({ ...current, collapsed: !current.collapsed }))}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              draft.collapsed ? 'bg-brand-600' : 'bg-slate-300',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                draft.collapsed ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
            <span className="sr-only">Compact sidebar</span>
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Modules</h3>
              <p className="text-xs text-slate-500">
                Drag inside a section to reorder, click a group header to collapse it in the sidebar.
              </p>
            </div>
            <button
              type="button"
              className="text-brand-600 text-xs font-medium hover:underline"
              onClick={() =>
                setDraft((current) => ({ ...current, hidden: [], collapsedGroups: [] }))
              }
            >
              Show all
            </button>
          </div>

          <div
            className="max-h-[50vh] space-y-3 overflow-y-auto pr-1"
            data-testid="sidebar-customizer-list"
          >
            {groups.map((group) => {
              const groupCollapsed = groupsCollapsed.has(group.id)
              return (
                <section
                  key={group.id}
                  data-testid={`sidebar-customizer-group-${group.id}`}
                >
                  <button
                    type="button"
                    aria-expanded={!groupCollapsed}
                    data-testid={`sidebar-customizer-group-toggle-${group.id}`}
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between rounded-md px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'size-3.5 transition-transform',
                        groupCollapsed && '-rotate-90',
                      )}
                    />
                  </button>
                  {!groupCollapsed && (
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isHidden = hidden.has(item.id)
                        const flatIndex = draft.order.indexOf(item.id)
                        return (
                          <li
                            key={item.id}
                            draggable
                            onDragStart={() => setDragging(item.id)}
                            onDragEnd={() => setDragging(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (dragging) {
                                setDraft((current) => ({
                                  ...current,
                                  order: moveSidebarItem(
                                    current.order,
                                    dragging,
                                    item.id,
                                  ),
                                }))
                              }
                              setDragging(null)
                            }}
                            data-testid={`sidebar-customizer-item-${item.id}`}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-2 py-2',
                              dragging === item.id
                                ? 'border-brand-300 bg-brand-50 opacity-60'
                                : 'border-slate-200 bg-white',
                              isHidden && 'opacity-60',
                            )}
                          >
                            <GripVertical
                              className="size-4 cursor-grab text-slate-400"
                              aria-hidden="true"
                            />
                            <Icon className="size-4 text-slate-500" />
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                              {item.label}
                            </span>
                            <button
                              type="button"
                              aria-label={`Move ${item.label} up`}
                              disabled={flatIndex === 0}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  order: moveSidebarItemBy(current.order, item.id, -1),
                                }))
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${item.label} down`}
                              disabled={flatIndex === draft.order.length - 1}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  order: moveSidebarItemBy(current.order, item.id, 1),
                                }))
                              }
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronDown className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`${isHidden ? 'Show' : 'Hide'} ${item.label}`}
                              aria-pressed={isHidden}
                              onClick={() => toggle(item.id)}
                              className={cn(
                                'rounded p-1 hover:bg-slate-100',
                                isHidden ? 'text-slate-400' : 'text-brand-600',
                              )}
                            >
                              {isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="sidebar-sort-az"
              onClick={() => {
                // Sort each group's items A-Z while keeping groups in their
                // native display order. Dashboard stays pinned at the top.
                const byId = new Map(items.map((i) => [i.id, i]))
                const sorted = draft.order
                  .map((id) => byId.get(id))
                  .filter(Boolean) as CustomizableSidebarItem[]
                sorted.sort((a, b) => {
                  // Dashboard-equivalents come first (they usually sit in the
                  // 'home' group — keep that stable at the very top).
                  if ((a.group ?? 'other') !== (b.group ?? 'other')) return 0
                  return a.label.localeCompare(b.label)
                })
                setDraft((current) => ({
                  ...current,
                  order: sorted.map((i) => i.id),
                }))
              }}
            >
              <ArrowDownAZ className="size-4" /> Sort A–Z
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="sidebar-reset"
              onClick={() =>
                setDraft({
                  order: ids,
                  hidden: [],
                  collapsed: false,
                  collapsedGroups: [],
                })
              }
            >
              <PanelLeftClose className="size-4" /> Reset default
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="sidebar-save"
              loading={saving}
              onClick={() => onSave(normalizeSidebarPreferences(ids, draft))}
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

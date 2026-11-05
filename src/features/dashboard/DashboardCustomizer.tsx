import { useMemo, useState } from 'react'
import { ArrowDownAZ, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { moveSidebarItem, moveSidebarItemBy } from '@/components/layout/sidebar-preferences'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { DashboardPreferences } from './dashboard-preferences'

export interface DashboardWidgetDefinition {
  id: string
  label: string
  /** Section header, used to group widgets inside the customizer modal. */
  group?: string
}

/**
 * Reorder-aware customizer with grouped sections. Items are shown inside their
 * `group`, in whatever order the preferences store, with show/hide + move-up /
 * move-down controls. The order field remains flat so storage stays the same.
 */
export function DashboardCustomizer({
  widgets,
  value,
  saving,
  onClose,
  onSave,
}: {
  widgets: DashboardWidgetDefinition[]
  value: DashboardPreferences
  saving: boolean
  onClose: () => void
  onSave: (value: DashboardPreferences) => void
}) {
  const ids = widgets.map((widget) => widget.id)
  const [draft, setDraft] = useState(value)
  const [dragging, setDragging] = useState<string | null>(null)
  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets])

  // Group the ids in their current preference order; items without a group
  // land in a trailing "Other" section.
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const id of draft.order) {
      const widget = byId.get(id)
      if (!widget) continue
      const key = widget.group ?? 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(id)
    }
    return [...map.entries()]
  }, [draft.order, byId])

  const toggle = (id: string) =>
    setDraft((current) => ({
      ...current,
      hidden: current.hidden.includes(id)
        ? current.hidden.filter((item) => item !== id)
        : [...current.hidden, id],
    }))

  const hiddenCount = draft.hidden.length

  return (
    <Modal open onClose={onClose} title="Customize dashboard" testid="dashboard-customizer">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Drag inside a section to reorder, use the eye to show or hide a card.
        </p>
        <button
          type="button"
          className="text-brand-600 text-xs font-medium hover:underline"
          onClick={() => setDraft((current) => ({ ...current, hidden: [] }))}
        >
          Show all ({hiddenCount} hidden)
        </button>
      </div>

      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1" data-testid="dashboard-customizer-list">
        {groups.map(([group, groupIds]) => (
          <section key={group}>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {group}
            </h4>
            <ul className="space-y-1">
              {groupIds.map((id) => {
                const widget = byId.get(id)!
                const hidden = draft.hidden.includes(id)
                const flatIndex = draft.order.indexOf(id)
                return (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => setDragging(id)}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragging)
                        setDraft((current) => ({
                          ...current,
                          order: moveSidebarItem(current.order, dragging, id),
                        }))
                      setDragging(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2',
                      hidden && 'opacity-55',
                      dragging === id && 'border-brand-300 bg-brand-50',
                    )}
                    data-testid={`dashboard-widget-${id}`}
                  >
                    <GripVertical className="size-4 cursor-grab text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {widget.label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${widget.label} up`}
                      disabled={flatIndex === 0}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          order: moveSidebarItemBy(current.order, id, -1),
                        }))
                      }
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${widget.label} down`}
                      disabled={flatIndex === draft.order.length - 1}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          order: moveSidebarItemBy(current.order, id, 1),
                        }))
                      }
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${hidden ? 'Show' : 'Hide'} ${widget.label}`}
                      className={cn('rounded p-1', hidden ? 'text-slate-400' : 'text-brand-600')}
                      onClick={() => toggle(id)}
                    >
                      {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="dashboard-sort-az"
            onClick={() => {
              // Sort widgets alphabetically within each group (groups stay in
              // their native display order).
              const label = (id: string) => byId.get(id)?.label ?? id
              const group = (id: string) => byId.get(id)?.group ?? 'Other'
              const next = [...draft.order].sort((a, b) =>
                group(a) === group(b) ? label(a).localeCompare(label(b)) : 0,
              )
              setDraft((current) => ({ ...current, order: next }))
            }}
          >
            <ArrowDownAZ className="size-4" /> Sort A–Z
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft({ order: ids, hidden: [] })}
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={() => onSave(draft)}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

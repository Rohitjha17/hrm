import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast-context'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import type { Tables } from '@/types/database.types'

type Location = Tables<'attendance_locations'>

function useLocations() {
  return useQuery({
    queryKey: ['attendance-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_locations')
        .select('*')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data ?? []) as Location[]
    },
  })
}

function useSaveLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Location> & { name: string; latitude: number; longitude: number; radius_meters: number }) => {
      const row = {
        name: patch.name,
        latitude: patch.latitude,
        longitude: patch.longitude,
        radius_meters: patch.radius_meters,
        is_active: patch.is_active ?? true,
        notes: patch.notes ?? null,
        sort_order: patch.sort_order ?? 0,
      }
      const q = patch.id
        ? supabase.from('attendance_locations').update(row).eq('id', patch.id)
        : supabase.from('attendance_locations').insert(row)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-locations'] }),
  })
}

function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attendance_locations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-locations'] }),
  })
}

/**
 * Admin-only CRUD for geo-fence locations. Punches are accepted at any ACTIVE
 * location within its own radius, so admins can shut off a site by toggling
 * Active instead of deleting it (deletion is permanent and nulls past punches).
 */
export function LocationsManager({ onClose }: { onClose: () => void }) {
  const { data: locations = [], isLoading } = useLocations()
  const [editing, setEditing] = useState<Location | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Location | null>(null)
  const del = useDeleteLocation()
  const toast = useToast()

  return (
    <Modal open onClose={onClose} title="Attendance locations" testid="locations-modal">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Punches are accepted at any active location within its own radius.
          </p>
          <Button
            size="sm"
            data-testid="add-location-button"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="size-4" /> Add location
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-slate-500">No locations yet. Add one so employees can punch in.</p>
        ) : (
          <ul className="space-y-2" data-testid="locations-list">
            {locations.map((loc) => (
              <li
                key={loc.id}
                data-testid={`location-row-${loc.id}`}
                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${
                  loc.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-brand-500" />
                    <span className="font-medium text-slate-900">{loc.name}</span>
                    {!loc.is_active && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {Number(loc.latitude).toFixed(6)}, {Number(loc.longitude).toFixed(6)} · radius{' '}
                    {loc.radius_meters} m
                  </div>
                  {loc.notes && <div className="mt-0.5 text-xs text-slate-400">{loc.notes}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    data-testid={`edit-location-${loc.id}`}
                    className="rounded-md p-1 text-slate-400 hover:text-brand-600"
                    onClick={() => setEditing(loc)}
                    aria-label={`Edit ${loc.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    data-testid={`delete-location-${loc.id}`}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setConfirmDelete(loc)}
                    aria-label={`Delete ${loc.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {newOpen && <LocationForm onClose={() => setNewOpen(false)} />}
      {editing && <LocationForm location={editing} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete location"
          confirmLabel="Delete"
          testid="delete-location-dialog"
          loading={del.isPending}
          onClose={() => setConfirmDelete(null)}
          message={
            <p>
              Delete <span className="font-semibold">{confirmDelete.name}</span>? Past punches tied
              to it stay (with the location name copied), but employees can no longer punch here.
              Prefer marking it Inactive if you may re-open the site later.
            </p>
          }
          onConfirm={() =>
            del.mutate(confirmDelete.id, {
              onSuccess: () => {
                toast.success('Location deleted')
                setConfirmDelete(null)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
    </Modal>
  )
}

function LocationForm({
  location,
  onClose,
}: {
  location?: Location
  onClose: () => void
}) {
  const save = useSaveLocation()
  const toast = useToast()
  const [name, setName] = useState(location?.name ?? '')
  const [latitude, setLatitude] = useState(String(location?.latitude ?? ''))
  const [longitude, setLongitude] = useState(String(location?.longitude ?? ''))
  const [radius, setRadius] = useState(String(location?.radius_meters ?? 50))
  const [active, setActive] = useState(location?.is_active ?? true)
  const [notes, setNotes] = useState(location?.notes ?? '')
  const [using, setUsing] = useState(false)

  function fillWithCurrent() {
    if (!('geolocation' in navigator)) {
      toast.error('Location unavailable', 'Your browser does not expose location.')
      return
    }
    setUsing(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(7))
        setLongitude(pos.coords.longitude.toFixed(7))
        setUsing(false)
      },
      (err) => {
        toast.error('Could not read location', err.message)
        setUsing(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={location ? `Edit: ${location.name}` : 'Add location'}
      testid="location-form-modal"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const lat = Number(latitude)
          const lng = Number(longitude)
          const rad = Number(radius)
          if (!name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(rad) || rad <= 0) {
            toast.error('Fill every field', 'Name, lat/lng and a positive radius are required.')
            return
          }
          save.mutate(
            {
              id: location?.id,
              name: name.trim(),
              latitude: lat,
              longitude: lng,
              radius_meters: Math.round(rad),
              is_active: active,
              notes: notes.trim() || null,
              sort_order: location?.sort_order ?? 0,
            },
            {
              onSuccess: () => {
                toast.success('Location saved')
                onClose()
              },
              onError: (err) => toast.error('Save failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="loc-name">Name</Label>
          <Input
            id="loc-name"
            data-testid="loc-name"
            placeholder="e.g. Head office, Pune branch"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="loc-lat">Latitude</Label>
            <Input
              id="loc-lat"
              data-testid="loc-lat"
              type="number"
              step="0.0000001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="loc-lng">Longitude</Label>
            <Input
              id="loc-lng"
              data-testid="loc-lng"
              type="number"
              step="0.0000001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            data-testid="loc-use-current"
            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
            disabled={using}
            onClick={fillWithCurrent}
          >
            {using ? 'Reading…' : 'Use my current location'}
          </button>
        </div>
        <div>
          <Label htmlFor="loc-radius">Radius (metres)</Label>
          <Input
            id="loc-radius"
            data-testid="loc-radius"
            type="number"
            min="1"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="loc-notes">Notes</Label>
          <Input
            id="loc-notes"
            data-testid="loc-notes"
            placeholder="Optional, e.g. floor or reception landmark"
            value={notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            data-testid="loc-active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Active — allow punches here</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="save-location" loading={save.isPending}>
            Save location
          </Button>
        </div>
      </form>
    </Modal>
  )
}

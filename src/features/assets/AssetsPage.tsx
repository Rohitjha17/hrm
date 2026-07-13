import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import {
  useActiveAssignments,
  useAssetAssignments,
  useAssets,
  useAssignAsset,
  useCreateAsset,
  useDeleteAsset,
  useReturnAsset,
  useTransferAsset,
  type Asset,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const ASSET_TYPES = ['laptop', 'desktop', 'mobile', 'sim', 'id_card', 'headset', 'other']

export function AssetsPage() {
  const { data: assets = [] } = useAssets()
  const { data: holders } = useActiveAssignments()
  const [createOpen, setCreateOpen] = useState(false)
  const [manage, setManage] = useState<Asset | null>(null)
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) =>
      [a.name, a.serial, a.batch_no, a.asset_type].some((f) => (f ?? '').toLowerCase().includes(q)),
    )
  }, [assets, search])

  return (
    <div data-testid="assets-page">
      <PageHeader
        title="Assets"
        description="Track company assets by serial & batch number, and their assignment history."
        actions={
          <Button data-testid="new-asset-button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New asset
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid="asset-search"
            placeholder="Search name, serial or batch no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No assets found" testid="assets-empty" />
      ) : (
        <Table data-testid="assets-table">
          <Thead>
            <tr>
              <Th>Asset</Th>
              <Th>Type</Th>
              <Th>Serial no</Th>
              <Th>Batch no</Th>
              <Th>Status</Th>
              <Th>Assigned to</Th>
              <Th className="text-right">Manage</Th>
            </tr>
          </Thead>
          <Tbody>
            {visible.map((a) => (
              <tr key={a.id} data-testid="asset-row">
                <Td className="font-medium text-slate-900">{a.name}</Td>
                <Td>{a.asset_type}</Td>
                <Td className="font-mono text-xs" data-testid="asset-serial-cell">{a.serial || '—'}</Td>
                <Td className="font-mono text-xs" data-testid="asset-batch-cell">{a.batch_no || '—'}</Td>
                <Td>
                  <Badge tone={a.status === 'assigned' ? 'amber' : a.status === 'retired' ? 'slate' : 'green'} data-testid="asset-status">
                    {a.status}
                  </Badge>
                </Td>
                <Td className="text-slate-600" data-testid="asset-holder-cell">{holders?.get(a.id) ?? '—'}</Td>
                <Td>
                  <div className="flex justify-end">
                    <button
                      data-testid="manage-asset"
                      className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      onClick={() => setManage(a)}
                    >
                      Manage
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      {createOpen && <CreateAssetModal onClose={() => setCreateOpen(false)} />}
      {manage && <AssetModal asset={manage} onClose={() => setManage(null)} />}
    </div>
  )
}

function CreateAssetModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAsset()
  const toast = useToast()
  const [assetType, setAssetType] = useState('laptop')
  const [name, setName] = useState('')
  const [serial, setSerial] = useState('')
  const [batchNo, setBatchNo] = useState('')
  return (
    <Modal open onClose={onClose} title="New asset" testid="asset-modal-create">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { assetType, name: name.trim(), serial: serial.trim() || undefined, batchNo: batchNo.trim() || undefined },
            { onSuccess: () => { toast.success('Asset created'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="as-type">Type</Label>
          <Select id="as-type" data-testid="asset-type" value={assetType} onChange={(e) => setAssetType(e.target.value)}>
            {ASSET_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </Select>
        </div>
        <div>
          <Label htmlFor="as-name">Name</Label>
          <Input id="as-name" data-testid="asset-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="as-serial">Serial no</Label>
            <Input id="as-serial" data-testid="asset-serial" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="as-batch">Batch no</Label>
            <Input id="as-batch" data-testid="asset-batch" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-asset" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

function AssetModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const { data: users = [] } = useUsers()
  const { data: history = [] } = useAssetAssignments(asset.id)
  const assign = useAssignAsset()
  const transfer = useTransferAsset()
  const ret = useReturnAsset()
  const del = useDeleteAsset()
  const toast = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const current = history.find((h) => !h.returned_at)
  const targetId = employeeId || users[0]?.id || ''

  return (
    <Modal open onClose={onClose} title={asset.name} testid="asset-modal">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>Type: <span className="font-medium text-slate-700">{asset.asset_type}</span></span>
          <span>Serial no: <span className="font-mono font-medium text-slate-700">{asset.serial || '—'}</span></span>
          <span>Batch no: <span className="font-mono font-medium text-slate-700">{asset.batch_no || '—'}</span></span>
        </div>
        <p className="text-sm" data-testid="current-holder">
          Current holder: <strong>{current?.assignee?.full_name ?? 'Unassigned'}</strong>
        </p>

        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <Label className="text-xs">Employee</Label>
            <Select data-testid="asset-employee" value={targetId} onChange={(e) => setEmployeeId(e.target.value)} className="w-48">
              {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
            </Select>
          </div>
          {!current ? (
            <Button size="sm" data-testid="assign-asset" loading={assign.isPending}
              onClick={() => assign.mutate({ assetId: asset.id, assigneeId: targetId }, { onSuccess: () => toast.success('Assigned'), onError: (e) => toast.error('Failed', (e as Error).message) })}>
              Assign
            </Button>
          ) : (
            <>
              <Button size="sm" data-testid="transfer-asset" loading={transfer.isPending}
                onClick={() => transfer.mutate({ assetId: asset.id, assigneeId: targetId }, { onSuccess: () => toast.success('Transferred'), onError: (e) => toast.error('Failed', (e as Error).message) })}>
                Transfer
              </Button>
              <Button size="sm" variant="outline" data-testid="return-asset" loading={ret.isPending}
                onClick={() => ret.mutate({ assetId: asset.id }, { onSuccess: () => toast.success('Returned') })}>
                Return
              </Button>
            </>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assignment history</h3>
          <ul className="space-y-1" data-testid="asset-history">
            {history.length === 0 && <li className="text-sm text-slate-500">No history yet.</li>}
            {history.map((h) => (
              <li key={h.id} data-testid="assignment-row" className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="font-medium">{h.assignee?.full_name ?? 'Unknown'}</span>
                <span className="text-xs text-slate-500">
                  {new Date(h.assigned_at).toLocaleDateString()} →{' '}
                  {h.returned_at ? new Date(h.returned_at).toLocaleDateString() : 'current'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          {!confirmDelete ? (
            <Button size="sm" variant="danger" data-testid="delete-asset" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Delete asset
            </Button>
          ) : (
            <span className="flex items-center gap-2 text-sm text-slate-600">
              Delete <strong>{asset.name}</strong> and its history?
              <Button
                size="sm"
                variant="danger"
                data-testid="confirm-delete-asset"
                loading={del.isPending}
                onClick={() =>
                  del.mutate(asset.id, {
                    onSuccess: () => {
                      toast.success('Asset deleted')
                      onClose()
                    },
                    onError: (e) => toast.error('Delete failed', (e as Error).message),
                  })
                }
              >
                Yes, delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </span>
          )}
          <Button variant="outline" data-testid="close-asset" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

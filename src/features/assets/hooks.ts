import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type Asset = Tables<'assets'>

export interface AssignmentRow extends Tables<'asset_assignments'> {
  assignee: { full_name: string; email: string } | null
}

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { assetType: string; name: string; serial?: string; batchNo?: string }) => {
      const { error } = await supabase.from('assets').insert({
        asset_type: input.assetType,
        name: input.name,
        serial: input.serial || null,
        batch_no: input.batchNo || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
}

/** Remove an asset and its assignment history. Requires assets.manage. */
export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', assetId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset-assignments'] })
    },
  })
}

export interface MyAssetRow extends Tables<'asset_assignments'> {
  asset: { name: string; asset_type: string; serial: string | null; batch_no: string | null } | null
}

/** Assets ever assigned to the signed-in employee (current ones first). */
export function useMyAssets(userId: string | null) {
  return useQuery({
    queryKey: ['my-assets', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_assignments')
        .select('*, asset:assets(name,asset_type,serial,batch_no)')
        .eq('assignee_id', userId!)
        .order('assigned_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as MyAssetRow[]
    },
  })
}

/** Active (unreturned) assignments → map asset_id → current holder name, for the list view. */
export function useActiveAssignments() {
  return useQuery({
    queryKey: ['asset-assignments', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_assignments')
        .select('asset_id, assignee:profiles(full_name,email)')
        .is('returned_at', null)
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of (data ?? []) as unknown as {
        asset_id: string
        assignee: { full_name: string | null; email: string } | null
      }[]) {
        map.set(row.asset_id, row.assignee?.full_name || row.assignee?.email || '—')
      }
      return map
    },
  })
}

export function useAssetAssignments(assetId: string | null) {
  return useQuery({
    queryKey: ['asset-assignments', assetId],
    enabled: !!assetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_assignments')
        .select('*, assignee:profiles(full_name,email)')
        .eq('asset_id', assetId!)
        .order('assigned_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as AssignmentRow[]
    },
  })
}

function assetMutation(rpc: 'assign_asset' | 'transfer_asset' | 'return_asset') {
  return function useAssetAction() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (args: { assetId: string; assigneeId?: string }) => {
        const params =
          rpc === 'return_asset'
            ? { p_asset: args.assetId }
            : rpc === 'assign_asset'
              ? { p_asset: args.assetId, p_assignee: args.assigneeId! }
              : { p_asset: args.assetId, p_new_assignee: args.assigneeId! }
        const { error } = await supabase.rpc(rpc, params)
        if (error) throw error
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['assets'] })
        qc.invalidateQueries({ queryKey: ['asset-assignments'] })
      },
    })
  }
}

export const useAssignAsset = assetMutation('assign_asset')
export const useTransferAsset = assetMutation('transfer_asset')
export const useReturnAsset = assetMutation('return_asset')

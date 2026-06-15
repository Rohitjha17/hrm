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
    mutationFn: async (input: { assetType: string; name: string; serial?: string }) => {
      const { error } = await supabase
        .from('assets')
        .insert({ asset_type: input.assetType, name: input.name, serial: input.serial || null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
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

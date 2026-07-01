-- ============================================================================
-- Asset enhancement: track a batch number alongside the existing serial number.
-- Assignment/allotment + full history already exist (asset_assignments + the
-- assign/transfer/return RPCs), so this only adds the batch identifier.
-- ============================================================================

alter table public.assets add column if not exists batch_no text;

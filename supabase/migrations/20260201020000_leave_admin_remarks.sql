-- ============================================================================
-- Leave enhancement: a free-form admin remark that can be attached to ANY leave
-- request (pending / approved / rejected), distinct from decision_remarks (which
-- is captured at approve/reject time). The existing leave_requests_update RLS
-- already lets holders of leave.approve UPDATE requests, so no policy change.
-- ============================================================================

alter table public.leave_requests add column if not exists admin_remarks text;

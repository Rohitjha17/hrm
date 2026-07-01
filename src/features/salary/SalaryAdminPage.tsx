import { useState } from 'react'
import { Calculator, FileText, Plus, Trash2 } from 'lucide-react'
import {
  parseComponents,
  useAddAdjustment,
  useAdjustments,
  useComputeFnf,
  useComputeSalary,
  useSalaryProfile,
  useUpsertSalaryProfile,
  type FnfSettlement,
  type SalaryComponent,
  type SalaryRun,
} from './hooks'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { useUsers } from '@/features/admin/users/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
    .format(new Date())
    .slice(0, 7)
}

export function SalaryAdminPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('salary.manage')
  const { data: users = [] } = useUsers()
  const [userId, setUserId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const effectiveUser = userId || users[0]?.id || ''

  const { data: adjustments = [] } = useAdjustments(effectiveUser, `${month}-01`)
  const compute = useComputeSalary()
  const toast = useToast()
  // Keyed by user|month so switching selection shows the right result, no effect.
  const [runByKey, setRunByKey] = useState<Record<string, SalaryRun>>({})
  const key = `${effectiveUser}|${month}`
  const run = runByKey[key] ?? null

  return (
    <div data-testid="salary-admin-page">
      <PageHeader title="Salary" description="Policy-driven salary, computed server-side." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="salary-user">Employee</Label>
          <Select id="salary-user" data-testid="salary-user-select" value={effectiveUser} onChange={(e) => setUserId(e.target.value)} className="w-56">
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="salary-month">Month</Label>
          <Input id="salary-month" data-testid="salary-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        </div>
        <Button
          data-testid="compute-salary"
          loading={compute.isPending}
          disabled={!canManage}
          onClick={() =>
            compute.mutate(
              { userId: effectiveUser, month },
              {
                onSuccess: (r) => {
                  setRunByKey((prev) => ({ ...prev, [key]: r }))
                  toast.success('Salary computed')
                },
                onError: (e) => toast.error('Compute failed', (e as Error).message),
              },
            )
          }
        >
          <Calculator className="size-4" /> Compute
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BaseSalaryCard key={effectiveUser} userId={effectiveUser} month={month} canManage={canManage} adjustments={adjustments} />

        <Card className="lg:col-span-2">
          <CardBody>
            <p className="mb-3 text-sm font-medium text-slate-500">Computed payslip</p>
            {!run ? (
              <p className="text-sm text-slate-400" data-testid="salary-prompt">
                Choose an employee + month and click Compute.
              </p>
            ) : (
              <div data-testid="salary-result">
                <div className="mb-4 flex gap-8">
                  <div>
                    <p className="text-xs text-slate-500">Gross</p>
                    <p className="text-2xl font-bold text-slate-900" data-testid="salary-gross">
                      {run.gross}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Net</p>
                    <p className="text-2xl font-bold text-emerald-700" data-testid="salary-net">
                      {run.net}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <Stat label="Present" value={run.present_days} />
                  <Stat label="Half" value={run.half_days} />
                  <Stat label="Quarter" value={run.quarter_days} />
                  <Stat label="Absent" value={run.absent_days} />
                  <Stat label="Paid leave" value={run.paid_leave_days} />
                  <Stat label="Late" value={run.late_count} />
                  <Stat label="Overtime (min)" value={run.overtime_minutes} />
                  <Stat label="Planning gaps" value={run.planning_noncompliant_days} />
                  <Stat label="Base earned" value={run.base_earned} />
                  <Stat label="Overtime pay" value={run.overtime_pay} />
                  <Stat label="Incentives" value={run.incentives} />
                  <Stat label="Increments" value={run.increments} />
                  <Stat label="Penalties" value={run.penalties} />
                  <Stat label="PF" value={run.pf} />
                  <Stat label="ESIC" value={run.esic} />
                  <Stat label="Prof. tax" value={run.professional_tax} />
                  <Stat label="TDS" value={run.tds} />
                </dl>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="download-payslip"
                    onClick={() =>
                      generateLetterPdf(`payslip-${month}`, 'Salary Slip', [
                        `Pay period: ${month}`,
                        `Gross: ${run.gross}   Net: ${run.net}`,
                        `Earnings — base ${run.base_earned}, overtime ${run.overtime_pay}, incentives ${run.incentives}, increments ${run.increments}`,
                        `Deductions — penalties ${run.penalties}, PF ${run.pf}, ESIC ${run.esic}, professional tax ${run.professional_tax}, TDS ${run.tds}`,
                      ])
                    }
                  >
                    <FileText className="size-4" /> Download payslip
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <FnfSection canManage={canManage} />
    </div>
  )
}

function FnfSection({ canManage }: { canManage: boolean }) {
  const { data: users = [] } = useUsers()
  const compute = useComputeFnf()
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [lastDay, setLastDay] = useState('')
  const [result, setResult] = useState<FnfSettlement | null>(null)
  const effectiveUser = userId || users[0]?.id || ''

  return (
    <div className="mt-8" data-testid="fnf-section">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Full &amp; Final settlement</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="fnf-user">Employee</Label>
          <Select id="fnf-user" data-testid="fnf-user-select" value={effectiveUser} onChange={(e) => setUserId(e.target.value)} className="w-48">
            {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fnf-date">Last working day</Label>
          <Input id="fnf-date" data-testid="fnf-date" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="w-44" />
        </div>
        <Button
          data-testid="compute-fnf"
          disabled={!canManage || !lastDay}
          loading={compute.isPending}
          onClick={() =>
            compute.mutate(
              { userId: effectiveUser, lastWorkingDate: lastDay },
              { onSuccess: (r) => { setResult(r); toast.success('F&F computed') }, onError: (e) => toast.error('Failed', (e as Error).message) },
            )
          }
        >
          <Calculator className="size-4" /> Compute F&amp;F
        </Button>
      </div>

      {result && (
        <div className="mt-4 flex flex-wrap items-center gap-6" data-testid="fnf-result">
          <Stat label="Final salary" value={result.final_salary} />
          <Stat label="Leave encashment" value={result.leave_encashment} />
          <Stat label="Dues" value={result.dues} />
          <div>
            <p className="text-xs text-slate-500">Net payable</p>
            <p className="text-2xl font-bold text-emerald-700" data-testid="fnf-net">{result.net_payable}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            data-testid="generate-fnf-letter"
            onClick={() =>
              generateLetterPdf(`fnf-${effectiveUser}`, 'Full & Final Settlement', [
                `Last working day: ${result.last_working_date}`,
                `Final salary: ${result.final_salary}`,
                `Leave encashment: ${result.leave_encashment}`,
                `Dues recovered: ${result.dues}`,
                `Net payable: ${result.net_payable}`,
              ])
            }
          >
            <FileText className="size-4" /> Generate F&amp;F letter
          </Button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  )
}

const DEFAULT_COMPONENTS: SalaryComponent[] = [
  { label: 'Basic', kind: 'earning', amount: 0 },
  { label: 'HRA', kind: 'earning', amount: 0 },
  { label: 'Special allowance', kind: 'earning', amount: 0 },
  { label: 'Provident fund', kind: 'deduction', amount: 0 },
]

function BaseSalaryCard({
  userId,
  month,
  canManage,
  adjustments,
}: {
  userId: string
  month: string
  canManage: boolean
  adjustments: Array<{ id: string; kind: string; amount: number }>
}) {
  const { data: profile } = useSalaryProfile(userId)
  const upsertProfile = useUpsertSalaryProfile()
  const toast = useToast()

  // Draft pattern (keyed by userId via parent `key`): seed from stored breakdown;
  // fall back to a single Basic = monthly_ctc row for legacy CTC-only profiles.
  const stored = parseComponents(profile?.components)
  const initial =
    stored.length > 0
      ? stored
      : profile?.monthly_ctc
        ? [{ label: 'Basic', kind: 'earning' as const, amount: Number(profile.monthly_ctc) }]
        : DEFAULT_COMPONENTS
  const [rows, setRows] = useState<SalaryComponent[]>(initial)

  const gross = rows.filter((r) => r.kind === 'earning').reduce((s, r) => s + Number(r.amount || 0), 0)
  const deductions = rows.filter((r) => r.kind === 'deduction').reduce((s, r) => s + Number(r.amount || 0), 0)
  const net = gross - deductions

  const update = (i: number, patch: Partial<SalaryComponent>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))
  const add = () => setRows((rs) => [...rs, { label: '', kind: 'earning', amount: 0 }])

  return (
    <Card>
      <CardBody className="space-y-3" data-testid="salary-breakdown-card">
        <p className="text-sm font-medium text-slate-500">Salary breakdown</p>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5" data-testid="salary-component-row">
              <Input
                aria-label="Component name"
                data-testid="component-label"
                placeholder="Component"
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                disabled={!canManage}
                className="h-9 flex-1"
              />
              <Select
                aria-label="Component type"
                data-testid="component-kind"
                value={r.kind}
                onChange={(e) => update(i, { kind: e.target.value as SalaryComponent['kind'] })}
                disabled={!canManage}
                className="h-9 w-28"
              >
                <option value="earning">Earning</option>
                <option value="deduction">Deduction</option>
              </Select>
              <Input
                aria-label="Component amount"
                data-testid="component-amount"
                type="number"
                value={r.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
                disabled={!canManage}
                className="h-9 w-24"
              />
              <button
                type="button"
                aria-label="Remove component"
                data-testid="remove-component"
                className="rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-40"
                disabled={!canManage}
                onClick={() => remove(i)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {canManage && (
          <Button type="button" size="sm" variant="outline" data-testid="add-component" onClick={add}>
            <Plus className="size-4" /> Add component
          </Button>
        )}

        <dl className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Gross (earnings)</dt>
            <dd className="font-medium text-slate-800" data-testid="breakdown-gross">{gross}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Deductions</dt>
            <dd className="font-medium text-slate-800" data-testid="breakdown-deductions">{deductions}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
            <dt className="font-medium text-slate-600">Net (in-hand)</dt>
            <dd className="font-bold text-emerald-700" data-testid="breakdown-net">{net}</dd>
          </div>
        </dl>

        <Button
          data-testid="save-breakdown"
          className="w-full"
          disabled={!canManage}
          loading={upsertProfile.isPending}
          onClick={() =>
            upsertProfile.mutate(
              { userId, components: rows.filter((r) => r.label.trim()) },
              {
                onSuccess: () => toast.success('Salary breakdown saved'),
                onError: (e) => toast.error('Save failed', (e as Error).message),
              },
            )
          }
        >
          Save breakdown
        </Button>

        <AdjustmentForm userId={userId} month={month} />
        <ul className="space-y-1 text-sm">
          {adjustments.map((a) => (
            <li key={a.id} className="flex justify-between">
              <Badge tone={a.kind === 'penalty' ? 'red' : a.kind === 'incentive' ? 'green' : 'blue'}>{a.kind}</Badge>
              <span>{a.amount}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

function AdjustmentForm({ userId, month }: { userId: string; month: string }) {
  const add = useAddAdjustment()
  const toast = useToast()
  const [kind, setKind] = useState<'incentive' | 'penalty' | 'increment'>('incentive')
  const [amount, setAmount] = useState('')

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        add.mutate(
          { userId, periodMonth: `${month}-01`, kind, amount: Number(amount) },
          {
            onSuccess: () => {
              toast.success('Adjustment added')
              setAmount('')
            },
            onError: (err) => toast.error('Failed', (err as Error).message),
          },
        )
      }}
    >
      <div>
        <Label className="text-xs">Adjustment</Label>
        <Select data-testid="adj-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9">
          <option value="incentive">Incentive</option>
          <option value="penalty">Penalty</option>
          <option value="increment">Increment</option>
        </Select>
      </div>
      <Input data-testid="adj-amount" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-28" required />
      <Button type="submit" size="sm" data-testid="add-adj" loading={add.isPending}>
        <Plus className="size-4" />
      </Button>
    </form>
  )
}

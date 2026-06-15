import { useState } from 'react'
import { Calculator, FileText, Plus } from 'lucide-react'
import {
  useAddAdjustment,
  useAdjustments,
  useComputeFnf,
  useComputeSalary,
  useSalaryProfile,
  useUpsertSalaryProfile,
  type FnfSettlement,
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
  // Draft pattern: show profile value until the user edits — no sync effect.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? (profile?.monthly_ctc != null ? String(profile.monthly_ctc) : '')

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm font-medium text-slate-500">Base salary</p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="ctc">Monthly CTC</Label>
            <Input id="ctc" data-testid="salary-ctc-input" type="number" value={value} onChange={(e) => setDraft(e.target.value)} disabled={!canManage} />
          </div>
          <Button
            data-testid="save-ctc"
            disabled={!canManage}
            loading={upsertProfile.isPending}
            onClick={() =>
              upsertProfile.mutate(
                { userId, monthlyCtc: Number(value) },
                { onSuccess: () => toast.success('Base salary saved') },
              )
            }
          >
            Save
          </Button>
        </div>
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

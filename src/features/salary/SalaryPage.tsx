import { parseComponents, useMySalaryRuns, useSalaryProfile } from './hooks'
import { useAuth } from '@/features/auth/auth-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function SalaryPage() {
  const { user } = useAuth()
  const { data: runs = [], isLoading } = useMySalaryRuns()
  const { data: profile } = useSalaryProfile(user?.id ?? null)
  const components = parseComponents(profile?.components)
  const gross = components.filter((c) => c.kind === 'earning').reduce((s, c) => s + c.amount, 0)
  const deductions = components.filter((c) => c.kind === 'deduction').reduce((s, c) => s + c.amount, 0)

  return (
    <div data-testid="salary-page">
      <PageHeader title="My Salary" description="Your salary structure and finalized payslips." />

      {components.length > 0 && (
        <Card className="mb-6" data-testid="my-salary-breakdown">
          <CardBody>
            <p className="mb-3 text-sm font-medium text-slate-500">Salary structure (monthly)</p>
            <ul className="divide-y divide-slate-100">
              {components.map((c, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Badge tone={c.kind === 'deduction' ? 'red' : 'green'}>{c.kind}</Badge>
                    {c.label}
                  </span>
                  <span className="font-medium text-slate-900">{c.amount}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end gap-6 border-t border-slate-200 pt-2 text-sm">
              <span className="text-slate-500">
                Gross <span className="font-semibold text-slate-800">{gross}</span>
              </span>
              <span className="text-slate-500">
                Net <span className="font-semibold text-emerald-700">{gross - deductions}</span>
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && runs.length === 0 ? (
        <EmptyState title="No payslips yet" testid="salary-empty" />
      ) : (
        <Table data-testid="my-salary-table">
          <Thead>
            <tr>
              <Th>Month</Th>
              <Th>Present</Th>
              <Th>Gross</Th>
              <Th>Net</Th>
            </tr>
          </Thead>
          <Tbody>
            {runs.map((r) => (
              <tr key={r.id} data-testid="salary-run-row">
                <Td className="font-medium text-slate-900">{r.period_month.slice(0, 7)}</Td>
                <Td>{r.present_days}</Td>
                <Td>{r.gross}</Td>
                <Td className="font-semibold text-emerald-700">{r.net}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

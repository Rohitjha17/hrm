import { useMySalaryRuns } from './hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function SalaryPage() {
  const { data: runs = [], isLoading } = useMySalaryRuns()

  return (
    <div data-testid="salary-page">
      <PageHeader title="My Salary" description="Your finalized payslips." />
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

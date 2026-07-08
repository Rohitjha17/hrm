import { useState } from 'react'
import { IdCard, Plus } from 'lucide-react'
import { useMyVisitors, useRegisterVisitor } from './hooks'
import { MeetingsSection } from './MeetingsSection'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toast-context'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function MyVisitorsPage() {
  const { user } = useAuth()
  const { data: visitors = [] } = useMyVisitors()
  const register = useRegisterVisitor()
  const toast = useToast()

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [purpose, setPurpose] = useState('')
  const [visitDate, setVisitDate] = useState('')

  return (
    <div data-testid="my-visitors-page">
      <PageHeader
        title="Visitors & Meetings"
        description="Register the visitors you're expecting, and host or respond to internal meetings."
      />

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              register.mutate(
                { name: name.trim(), company, purpose, hostId: user?.id ?? null, visitDate },
                {
                  onSuccess: () => {
                    toast.success('Visitor registered')
                    setName('')
                    setCompany('')
                    setPurpose('')
                  },
                  onError: (err) => toast.error('Failed', (err as Error).message),
                },
              )
            }}
          >
            <div>
              <Label className="text-xs">Visitor name</Label>
              <Input data-testid="my-visitor-name" value={name} onChange={(e) => setName(e.target.value)} required className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input data-testid="my-visitor-company" value={company} onChange={(e) => setCompany(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Purpose</Label>
              <Input data-testid="my-visitor-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Visit date</Label>
              <Input data-testid="my-visitor-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required className="w-40" />
            </div>
            <Button type="submit" data-testid="my-register-visitor" loading={register.isPending}>
              <Plus className="size-4" /> Register
            </Button>
          </form>
        </CardBody>
      </Card>

      {visitors.length === 0 ? (
        <EmptyState title="No visitors registered yet" testid="my-visitors-empty" />
      ) : (
        <Table data-testid="my-visitors-table">
          <Thead>
            <tr>
              <Th>Visitor</Th>
              <Th>Purpose</Th>
              <Th>Date</Th>
              <Th>Pass code</Th>
              <Th className="text-right">Pass</Th>
            </tr>
          </Thead>
          <Tbody>
            {visitors.map((v) => (
              <tr key={v.id} data-testid="my-visitor-row">
                <Td className="font-medium text-slate-900">
                  {v.name}
                  {v.company && <div className="text-xs font-normal text-slate-500">{v.company}</div>}
                </Td>
                <Td className="text-slate-600">{v.purpose || '—'}</Td>
                <Td>{v.visit_date}</Td>
                <Td>
                  <Badge tone="slate" data-testid="my-pass-code">
                    {v.pass_code}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="my-generate-pass"
                      onClick={() =>
                        generateLetterPdf(`visitor-pass-${v.pass_code}`, 'Visitor Pass', [
                          `Visitor: ${v.name}${v.company ? ` (${v.company})` : ''}`,
                          `Date: ${v.visit_date}`,
                          `Pass code: ${v.pass_code}`,
                        ])
                      }
                    >
                      <IdCard className="size-4" /> Pass
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      <MeetingsSection />
    </div>
  )
}

import { useState } from 'react'
import { IdCard, Plus } from 'lucide-react'
import { useRegisterVisitor, useVisitors } from './hooks'
import { MeetingsSection } from './MeetingsSection'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function VisitorsPage() {
  const { data: visitors = [] } = useVisitors()
  const { data: users = [] } = useUsers()
  const register = useRegisterVisitor()
  const toast = useToast()
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [hostId, setHostId] = useState('')
  const [visitDate, setVisitDate] = useState('')

  return (
    <div data-testid="visitors-page">
      <PageHeader title="Visitors & Meetings" description="Register visitors, issue passes, and manage internal meetings." />

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              register.mutate(
                { name: name.trim(), company, hostId: hostId || users[0]?.id || null, visitDate },
                { onSuccess: () => { toast.success('Visitor registered'); setName(''); setCompany('') }, onError: (err) => toast.error('Failed', (err as Error).message) },
              )
            }}
          >
            <div>
              <Label className="text-xs">Visitor name</Label>
              <Input data-testid="visitor-name" value={name} onChange={(e) => setName(e.target.value)} required className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input data-testid="visitor-company" value={company} onChange={(e) => setCompany(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Host</Label>
              <Select data-testid="visitor-host" value={hostId || users[0]?.id || ''} onChange={(e) => setHostId(e.target.value)} className="w-44">
                {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
              </Select>
            </div>
            <div>
              <Label className="text-xs">Visit date</Label>
              <Input data-testid="visitor-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required className="w-40" />
            </div>
            <Button type="submit" data-testid="register-visitor" loading={register.isPending}>
              <Plus className="size-4" /> Register
            </Button>
          </form>
        </CardBody>
      </Card>

      {visitors.length === 0 ? (
        <EmptyState title="No visitors yet" testid="visitors-empty" />
      ) : (
        <Table data-testid="visitors-table">
          <Thead>
            <tr>
              <Th>Visitor</Th>
              <Th>Host</Th>
              <Th>Date</Th>
              <Th>Pass</Th>
              <Th className="text-right">Pass</Th>
            </tr>
          </Thead>
          <Tbody>
            {visitors.map((v) => (
              <tr key={v.id} data-testid="visitor-row">
                <Td className="font-medium text-slate-900">
                  {v.name}
                  {v.company && <div className="text-xs font-normal text-slate-500">{v.company}</div>}
                </Td>
                <Td>{v.host_id ? (nameById.get(v.host_id) ?? '—') : '—'}</Td>
                <Td>{v.visit_date}</Td>
                <Td><Badge tone="slate" data-testid="pass-code">{v.pass_code}</Badge></Td>
                <Td>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="generate-pass"
                      onClick={() =>
                        generateLetterPdf(`visitor-pass-${v.pass_code}`, 'Visitor Pass', [
                          `Visitor: ${v.name}${v.company ? ` (${v.company})` : ''}`,
                          `Host: ${v.host_id ? (nameById.get(v.host_id) ?? '—') : '—'}`,
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

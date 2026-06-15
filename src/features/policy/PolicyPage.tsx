import { useAcknowledgePolicy, useAllVersions, useMyAcknowledgements, usePolicies } from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export function PolicyPage() {
  const { data: policies = [] } = usePolicies()
  const { data: versions = [] } = useAllVersions()
  const { data: acks } = useMyAcknowledgements()
  const acknowledge = useAcknowledgePolicy()
  const toast = useToast()

  const active = policies.filter((p) => p.current_version > 0)

  return (
    <div data-testid="policy-page">
      <PageHeader title="Policies" description="Read and acknowledge company policies." />
      {active.length === 0 ? (
        <EmptyState title="No published policies yet" testid="policy-empty" />
      ) : (
        <div className="space-y-4">
          {active.map((p) => {
            const current = versions.find((v) => v.policy_id === p.id && v.version === p.current_version)
            const acked = current ? acks?.has(current.id) : false
            return (
              <Card key={p.id} data-testid={`policy-card-${p.category}`}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{p.title}</h3>
                        <Badge tone="slate">{p.category}</Badge>
                        <Badge tone="brand">v{p.current_version}</Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {current?.content}
                      </p>
                    </div>
                    {acked ? (
                      <Badge tone="green" data-testid={`policy-acked-${p.category}`}>
                        Acknowledged
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        data-testid={`acknowledge-${p.category}`}
                        loading={acknowledge.isPending}
                        onClick={() =>
                          current &&
                          acknowledge.mutate(current.id, {
                            onSuccess: () => toast.success('Acknowledged'),
                          })
                        }
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

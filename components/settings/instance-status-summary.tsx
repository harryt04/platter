import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InstancePolicySummary } from '@/lib/instance-policy'

const badgeVariant = {
  enabled: 'success',
  disabled: 'outline',
  incomplete: 'warning',
} as const

export function InstanceStatusSummary({
  summary,
}: {
  summary: InstancePolicySummary
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summary.services.map((service) => (
        <Card key={service.id}>
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle>{service.label}</CardTitle>
              <Badge variant={badgeVariant[service.status]}>
                {service.statusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{service.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

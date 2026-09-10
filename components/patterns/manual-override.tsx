import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ManualOverride() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping amount</CardTitle>
        <p className="text-muted-foreground text-sm">
          Your shopping amount can differ from the calculation without changing
          the recipes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-data text-sm">2 lb to buy</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Calculated requirement: 3 lb
            </p>
          </div>
          <Button variant="outline">
            <RotateCcw size={16} />
            Reset to calculated amount
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

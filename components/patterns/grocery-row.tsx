import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function GroceryRow({
  ingredient,
  amount,
  category = 'Produce',
  state = 'buy',
}: {
  ingredient: string
  amount: string
  category?: string
  state?: 'buy' | 'already-have' | 'purchased'
}) {
  return (
    <Card className="flex min-h-16 items-center gap-3 rounded-lg p-3">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-data text-sm font-medium">{amount}</span>
          <span>{ingredient}</span>
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <span>{category}</span>
          <span aria-hidden="true">·</span>
          <span>
            {state === 'already-have'
              ? 'Already have'
              : state === 'purchased'
                ? 'Purchased'
                : 'From Tacos + Curry'}
          </span>
        </div>
      </div>
      <Badge
        variant={
          state === 'purchased'
            ? 'success'
            : state === 'already-have'
              ? 'secondary'
              : 'outline'
        }
      >
        {state === 'buy'
          ? 'To buy'
          : state === 'already-have'
            ? 'Already have'
            : 'Purchased'}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`View contribution details for ${ingredient}`}
      >
        <MoreHorizontal size={18} />
      </Button>
    </Card>
  )
}

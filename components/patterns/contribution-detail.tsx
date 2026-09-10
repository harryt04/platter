import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ContributionDetail() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution detail</CardTitle>
        <p className="text-muted-foreground text-sm">
          This is how the calculated requirement was formed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span>1 onion from Tacos</span>
          <span className="font-data">1</span>
        </div>
        <div className="flex justify-between">
          <span>1 onion from Curry</span>
          <span className="font-data">1</span>
        </div>
        <div className="border-t pt-3 font-medium">
          <div className="flex justify-between">
            <span>Calculated requirement</span>
            <span className="font-data">2 onions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

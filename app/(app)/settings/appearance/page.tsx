import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppearanceForm } from '@/components/settings/appearance-form'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
export default function AppearancePage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Settings"
        title="Appearance"
        description="Choose System, Light, or Dark. The preference is stored on this device."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Theme preference</CardTitle>
        </CardHeader>
        <CardContent>
          <AppearanceForm />
        </CardContent>
      </Card>
    </ContentContainer>
  )
}

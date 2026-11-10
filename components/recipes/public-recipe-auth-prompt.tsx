import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PublicRecipeAuthPrompt({ recipeId }: { recipeId: string }) {
  const returnTo = encodeURIComponent(`/recipes/${recipeId}`)

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Keep this recipe handy</CardTitle>
        <CardDescription>
          Sign in before saving this recipe or adding it to one of your lists.
          You’ll return here after authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href={`/sign-in?returnTo=${returnTo}`}>
            Sign in to continue
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/sign-up?returnTo=${returnTo}`}>Create an account</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

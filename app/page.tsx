import { getSession } from '@/lib/auth/authorization'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await getSession()
  redirect(session ? '/lists' : '/discover')
}

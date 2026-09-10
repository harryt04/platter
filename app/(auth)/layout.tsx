import { getSession } from '@/lib/auth/authorization'
import { redirect } from 'next/navigation'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (await getSession()) redirect('/lists')
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      {children}
    </div>
  )
}

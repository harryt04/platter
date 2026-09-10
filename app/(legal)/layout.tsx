import { PublicHeader } from '@/components/shell/public-header'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  )
}

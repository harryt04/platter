export function ScrollArea({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`overflow-auto ${className}`}>{children}</div>
}

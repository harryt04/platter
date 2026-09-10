export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const DropdownMenuTrigger = ({
  children,
}: {
  children: React.ReactNode
}) => <>{children}</>
export const DropdownMenuContent = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <div className="bg-popover rounded-md border p-1 shadow-lg">{children}</div>
)
export const DropdownMenuItem = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <div className="hover:bg-muted flex min-h-11 items-center rounded px-3 text-sm">
    {children}
  </div>
)

export const Popover = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const PopoverTrigger = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const PopoverContent = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-popover rounded-md border p-4 shadow-lg">{children}</div>
)

export const Select = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const SelectTrigger = ({ children }: { children: React.ReactNode }) => (
  <button className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-control)] border px-3 text-sm">
    {children}
  </button>
)
export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span>{placeholder}</span>
)
export const SelectContent = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-popover rounded-md border p-1">{children}</div>
)
export const SelectItem = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-11 px-3 py-2 text-sm">{children}</div>
)

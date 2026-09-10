export const Sheet = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const SheetTrigger = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const SheetContent = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l p-6 shadow-xl">
    {children}
  </div>
)

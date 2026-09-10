export const Tabs = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
)
export const TabsList = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex rounded-md border p-1">{children}</div>
)
export const TabsTrigger = ({ children }: { children: React.ReactNode }) => (
  <button className="min-h-10 rounded px-3 text-sm">{children}</button>
)
export const TabsContent = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4">{children}</div>
)

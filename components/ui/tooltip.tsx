export const TooltipProvider = ({
  children,
}: {
  children: React.ReactNode
}) => <>{children}</>
export const Tooltip = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const TooltipTrigger = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)
export const TooltipContent = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-foreground text-background rounded px-2 py-1 text-xs">
    {children}
  </span>
)

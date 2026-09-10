import type { ReactNode } from 'react'
export function Form({ children }: { children: ReactNode }) {
  return <>{children}</>
}
export function FormItem({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>
}
export function FormLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-medium">{children}</label>
}
export function FormMessage({ children }: { children?: ReactNode }) {
  return <p className="text-destructive text-sm">{children}</p>
}

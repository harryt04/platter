import * as React from 'react'
export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className="accent-primary h-5 w-5" {...props} />
}

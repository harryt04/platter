'use client'
import {
  ScrollArea as Root,
  ScrollAreaViewport,
  ScrollAreaContent,
} from '@ui-sdk/react/scroll-area'
export function ScrollArea({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Root className={className}>
      <ScrollAreaViewport className="h-full overflow-auto">
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
    </Root>
  )
}

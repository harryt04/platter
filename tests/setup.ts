import '@testing-library/jest-dom/vitest'

// jsdom gaps that UI SDK popups, toasts and dialogs rely on; see
// node_modules/@ui-sdk/core/skills/ui-sdk/references/testing.md#jsdom.
if (typeof window !== 'undefined') {
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  globalThis.CSS ??= {} as typeof CSS
  globalThis.CSS.supports ??= () => false
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: '[popover] { display: block !important }',
    }),
  )
}

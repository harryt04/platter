import { expect, test } from '@playwright/test'

type Tool = { name: string; execute(input: unknown): Promise<unknown> }
declare global {
  interface Window {
    platterTestTools: Map<string, Tool>
  }
}

test('WebMCP can edit and run a public search while auth fields stay hidden', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.platterTestTools = new Map()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        async registerTool(tool: Tool, { signal }: { signal: AbortSignal }) {
          window.platterTestTools.set(tool.name, tool)
          signal.addEventListener(
            'abort',
            () => window.platterTestTools.delete(tool.name),
            { once: true },
          )
        },
      },
    })
  })
  await page.goto('/discover')
  await expect
    .poll(() => page.evaluate(() => window.platterTestTools.size))
    .toBe(3)
  await page.evaluate(() =>
    window.platterTestTools.get('act')!.execute({
      steps: [
        { ref: 'Search recipes', action: 'setValue', args: ['radishes'] },
      ],
    }),
  )
  await expect(page.getByLabel('Search recipes')).toHaveValue('radishes')
  await page.evaluate(async () => {
    const controls = (await window.platterTestTools
      .get('snapshot')!
      .execute({})) as { ref: string; component: string; label?: string }[]
    const search = controls.find(
      (control) => control.component === 'button' && control.label === 'Search',
    )
    if (!search) throw new Error('Search button missing from snapshot')
    void window.platterTestTools.get('act')!.execute({
      steps: [{ ref: search.ref, action: 'press' }],
    })
  })
  await expect(page).toHaveURL(/\/discover\?q=radishes/)
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('synthetic@example.test')
  await expect
    .poll(() => page.evaluate(() => window.platterTestTools.size))
    .toBe(3)
  const snapshot = await page.evaluate(async () =>
    JSON.stringify(await window.platterTestTools.get('snapshot')!.execute({})),
  )
  expect(snapshot).not.toContain('synthetic@example.test')
  expect(snapshot).not.toContain('Password')
})

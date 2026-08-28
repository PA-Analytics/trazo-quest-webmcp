import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'desktop', width: 900, height: 540 },
  { name: 'mobile', width: 390, height: 540 },
]) {
  test(`${viewport.name} cold Quest world keeps a fixed canvas viewport`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')

    await expect(page.locator('.app-shell--empty-quest')).toBeVisible()
    await expect(page.getByLabel('Lienzo del mapa de misiones')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tu ruta empieza aquí' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => {
      const html = document.documentElement
      const appRoot = document.getElementById('root')
      return Boolean(
        appRoot
        && document.body.scrollHeight === document.body.clientHeight
        && appRoot.scrollHeight === appRoot.clientHeight
        && html.scrollHeight === html.clientHeight
      )
    })).toBe(true)
  })
}

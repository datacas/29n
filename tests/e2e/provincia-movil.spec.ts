import { test, expect } from '@playwright/test'

/** El selector de provincia no puede salirse de su recuadro en móvil (320–390 px) ni crear desplazamiento horizontal. Requiere el servidor en baseURL. */
const RELEASE = '89372a15-c0fe-4b22-a3a2-e6b3e18522e6'
for (const width of [320, 360, 390]) {
  test(`provincia dentro del recuadro a ${width}px`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage()
    await page.goto(`${baseURL}/survey/${RELEASE}/start`); await page.waitForSelector('#provincia')
    const m = await page.evaluate(() => { const s = document.querySelector('#provincia') as HTMLElement; const body = s.closest('.label__body') as HTMLElement
      const bs = body.getBoundingClientRect(), ss = s.getBoundingClientRect(); return { selRight: ss.right, bodyRight: bs.right, selLeft: ss.left, bodyLeft: bs.left, scroll: document.documentElement.scrollWidth, vw: window.innerWidth } })
    expect(m.selRight).toBeLessThanOrEqual(m.bodyRight + 0.5); expect(m.selLeft).toBeGreaterThanOrEqual(m.bodyLeft - 0.5); expect(m.scroll).toBeLessThanOrEqual(m.vw)
    await ctx.close()
  })
}

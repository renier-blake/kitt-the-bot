import { chromium } from 'playwright'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function refresh() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  const page = browser.pages()[0] || await browser.newPage()
  
  await page.reload()
  await page.waitForTimeout(3000)
  
  await browser.close()
  console.log('Page refreshed')
}

refresh().catch(console.error)

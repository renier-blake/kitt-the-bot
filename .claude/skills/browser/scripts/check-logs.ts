import { chromium } from 'playwright'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function check() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  const page = browser.pages()[0] || await browser.newPage()
  
  const logs: any[] = []
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }))
  
  await page.goto('http://localhost:3000/projects')
  await page.waitForTimeout(4000)
  
  await browser.close()
  console.log(JSON.stringify(logs, null, 2))
}

check()

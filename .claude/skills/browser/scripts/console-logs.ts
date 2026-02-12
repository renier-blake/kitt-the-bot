import { chromium } from 'playwright'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function getConsoleLogs() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  
  const page = browser.pages()[0] || await browser.newPage()
  
  const logs: any[] = []
  
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text() })
  })
  
  page.on('pageerror', error => {
    logs.push({ type: 'pageerror', text: error.message })
  })
  
  // Wait for any pending logs
  await page.waitForTimeout(3000)
  
  await browser.close()
  
  console.log(JSON.stringify({ success: true, logs }, null, 2))
}

getConsoleLogs().catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }))
  process.exit(1)
})

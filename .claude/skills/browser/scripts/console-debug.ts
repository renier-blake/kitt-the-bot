import { chromium } from 'playwright'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function debug() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  const page = browser.pages()[0] || await browser.newPage()
  
  const logs: any[] = []
  page.on('console', msg => {
    const log = { type: msg.type(), text: msg.text() }
    logs.push(log)
    console.log(`[${msg.type()}] ${msg.text()}`)
  })
  
  page.on('pageerror', error => {
    const log = { type: 'pageerror', text: error.message }
    logs.push(log)
    console.log(`[PAGE ERROR] ${error.message}`)
  })
  
  // Navigate and wait for load
  await page.goto('http://localhost:3000/projects')
  await page.waitForTimeout(5000)
  
  // Check if issues are rendered
  const issueCards = await page.locator('[class*="Card"]').count()
  console.log(`\n=== Found ${issueCards} issue cards ===`)
  
  await browser.close()
  
  // Summary
  console.log('\n=== Summary ===')
  const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror')
  if (errors.length === 0) {
    console.log('No errors found!')
  } else {
    console.log(`${errors.length} errors found:`)
    errors.forEach(e => console.log(`  - ${e.text.substring(0, 100)}`))
  }
}

debug().catch(console.error)

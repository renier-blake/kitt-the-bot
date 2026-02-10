import { chromium } from 'playwright'
import * as fs from 'fs'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function getConsoleLogs() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  
  const page = browser.pages()[0] || await browser.newPage()
  
  const logs: string[] = []
  
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    logs.push(text)
    console.log(text)
  })
  
  page.on('pageerror', error => {
    const text = `[pageerror] ${error.message}`
    logs.push(text)
    console.log(text)
  })
  
  // Wait a bit for any pending logs
  await page.waitForTimeout(2000)
  
  await browser.close()
  
  console.log(JSON.stringify({ success: true, logs }, null, 2))
}

getConsoleLogs().catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }))
  process.exit(1)
})

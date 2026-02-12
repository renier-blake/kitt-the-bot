import { chromium } from 'playwright'

const PROFILE_PATH = '.claude/skills/browser/data/browser-profile'

async function debug() {
  const browser = await chromium.launchPersistentContext(PROFILE_PATH, {
    headless: false,
  })
  const page = browser.pages()[0] || await browser.newPage()
  
  // Intercept API calls
  const apiCalls: any[] = []
  page.on('response', async response => {
    const url = response.url()
    if (url.includes('/api/issues')) {
      const status = response.status()
      try {
        const body = await response.json()
        apiCalls.push({ url, status, issueCount: body.issues?.length || 0, error: body.error })
        console.log(`API Call: ${url}`)
        console.log(`  Status: ${status}`)
        console.log(`  Issues: ${body.issues?.length || 0}`)
        if (body.error) console.log(`  Error: ${body.error}`)
      } catch (e) {
        apiCalls.push({ url, status, error: 'Not JSON' })
      }
    }
  })
  
  await page.goto('http://localhost:3000/projects')
  await page.waitForTimeout(6000)
  
  console.log('\n=== All API Calls ===')
  apiCalls.forEach((call, i) => {
    console.log(`${i + 1}. ${call.url.split('?')[1] || 'no params'}`)
    console.log(`   Issues: ${call.issueCount}, Status: ${call.status}`)
  })
  
  await browser.close()
}

debug().catch(console.error)

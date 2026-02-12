import { createClient } from '@libsql/client'
import * as fs from 'fs'

const dbPath = './data/kitt.db'

async function check() {
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found')
    return
  }
  
  console.log('Database size:', fs.statSync(dbPath).size, 'bytes')
  
  const db = createClient({ url: `file:${dbPath}` })
  
  // List all tables
  const tablesResult = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
  console.log('\nTables:')
  for (const row of tablesResult.rows) {
    console.log(`  - ${row.name}`)
  }
  
  // Check if portal_issues exists
  if (tablesResult.rows.some((r: any) => r.name === 'portal_issues')) {
    const tableInfo = await db.execute("PRAGMA table_info(portal_issues)")
    console.log('\nportal_issues columns:')
    for (const row of tableInfo.rows) {
      console.log(`  - ${row.name}: ${row.type}`)
    }
  }
}

check().catch(console.error)

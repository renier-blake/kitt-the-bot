import { createClient } from '@libsql/client'
import * as fs from 'fs'

const dbPath = './profile/data/kitt.db'

async function check() {
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found at', dbPath)
    return
  }
  
  console.log('Database size:', fs.statSync(dbPath).size, 'bytes')
  
  const db = createClient({ url: `file:${dbPath}` })
  
  // Check schema version
  try {
    const versionResult = await db.execute("SELECT value FROM meta WHERE key = 'schema_version'")
    console.log('Schema version:', versionResult.rows[0]?.value)
  } catch (e) {
    console.log('No meta table yet')
  }
  
  // Check if portal_issues exists
  const tablesResult = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='portal_issues'")
  if (tablesResult.rows.length > 0) {
    const tableInfo = await db.execute("PRAGMA table_info(portal_issues)")
    console.log('\nportal_issues columns:')
    for (const row of tableInfo.rows) {
      console.log(`  - ${row.name}: ${row.type}`)
    }
  } else {
    console.log('portal_issues table not found')
  }
}

check().catch(console.error)

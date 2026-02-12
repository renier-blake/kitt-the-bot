import { createClient } from '@libsql/client'

const dbPath = './profile/data/kitt.db'

async function migrate() {
  const db = createClient({ url: `file:${dbPath}` })
  
  console.log('Running migration v16 -> v17...')
  
  // Add scheduled_date column
  try {
    await db.execute(`ALTER TABLE portal_issues ADD COLUMN scheduled_date INTEGER`)
    console.log('✓ Added scheduled_date column')
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ scheduled_date already exists')
    } else {
      console.error('✗ Error adding scheduled_date:', err.message)
    }
  }
  
  // Add scheduled_time_start column
  try {
    await db.execute(`ALTER TABLE portal_issues ADD COLUMN scheduled_time_start INTEGER`)
    console.log('✓ Added scheduled_time_start column')
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ scheduled_time_start already exists')
    } else {
      console.error('✗ Error adding scheduled_time_start:', err.message)
    }
  }
  
  // Add scheduled_time_end column
  try {
    await db.execute(`ALTER TABLE portal_issues ADD COLUMN scheduled_time_end INTEGER`)
    console.log('✓ Added scheduled_time_end column')
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ scheduled_time_end already exists')
    } else {
      console.error('✗ Error adding scheduled_time_end:', err.message)
    }
  }
  
  // Add scheduled_timezone column
  try {
    await db.execute(`ALTER TABLE portal_issues ADD COLUMN scheduled_timezone TEXT DEFAULT 'Europe/Amsterdam'`)
    console.log('✓ Added scheduled_timezone column')
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ scheduled_timezone already exists')
    } else {
      console.error('✗ Error adding scheduled_timezone:', err.message)
    }
  }
  
  // Add start_date column
  try {
    await db.execute(`ALTER TABLE portal_issues ADD COLUMN start_date INTEGER`)
    console.log('✓ Added start_date column')
  } catch (err: any) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ start_date already exists')
    } else {
      console.error('✗ Error adding start_date:', err.message)
    }
  }
  
  // Create index
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_issues_scheduled ON portal_issues(scheduled_date)')
    console.log('✓ Created index on scheduled_date')
  } catch (err: any) {
    console.error('✗ Error creating index:', err.message)
  }
  
  console.log('\nMigration complete!')
}

migrate().catch(console.error)

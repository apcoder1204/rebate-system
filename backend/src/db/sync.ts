import { primaryPool, backupPool } from './connection';

/**
 * Sync data from primary (Neon) to backup (localhost)
 * This ensures backup has all data from primary
 */
export async function syncToBackup() {
  console.log('🔄 Starting database sync from Neon to localhost...');

  try {
    // Get all tables
    const tables = [
      'users',
      'contracts',
      'orders',
      'role_requests',
      'verification_codes',
    ];

    for (const table of tables) {
      try {
        console.log(`📦 Syncing ${table}...`);

        // Get all data from primary
        const primaryData = await primaryPool.query(`SELECT * FROM ${table}`);

        if (primaryData.rows.length === 0) {
          console.log(`   ⏭️  ${table} is empty, skipping`);
          continue;
        }

        // Check if table exists in backup
        const tableExists = await backupPool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);

        if (!tableExists.rows[0].exists) {
          console.log(`   ⚠️  Table ${table} doesn't exist in backup, skipping`);
          continue;
        }

        // Get existing IDs in backup to avoid duplicates
        const existingIds = await backupPool.query(`SELECT id FROM ${table}`);
        const existingIdSet = new Set(existingIds.rows.map((row: any) => row.id));

        // Insert new records
        let inserted = 0;
        let skipped = 0;

        for (const row of primaryData.rows) {
          if (existingIdSet.has(row.id)) {
            skipped++;
            continue;
          }

          // Build insert query dynamically
          const columns = Object.keys(row).filter(key => row[key] !== null);
          const values = columns.map((_, index) => `$${index + 1}`);
          const placeholders = columns.map((_, index) => row[columns[index]]);

          try {
            await backupPool.query(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`,
              placeholders
            );
            inserted++;
          } catch (error: any) {
            console.error(`   ❌ Error inserting row into ${table}:`, error.message);
          }
        }

        console.log(`   ✅ ${table}: ${inserted} inserted, ${skipped} skipped`);
      } catch (error: any) {
        console.error(`   ❌ Error syncing ${table}:`, error.message);
      }
    }

    console.log('✅ Database sync completed!');
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync data from backup (localhost) to primary (Neon)
 * Use this if you need to restore from backup
 */
export async function syncToPrimary() {
  console.log('🔄 Starting database sync from localhost to Neon...');

  try {
    const tables = [
      'users',
      'contracts',
      'orders',
      'role_requests',
      'verification_codes',
    ];

    for (const table of tables) {
      try {
        console.log(`📦 Syncing ${table}...`);

        const backupData = await backupPool.query(`SELECT * FROM ${table}`);

        if (backupData.rows.length === 0) {
          console.log(`   ⏭️  ${table} is empty, skipping`);
          continue;
        }

        const existingIds = await primaryPool.query(`SELECT id FROM ${table}`);
        const existingIdSet = new Set(existingIds.rows.map((row: any) => row.id));

        let inserted = 0;
        let skipped = 0;

        for (const row of backupData.rows) {
          if (existingIdSet.has(row.id)) {
            skipped++;
            continue;
          }

          const columns = Object.keys(row).filter(key => row[key] !== null);
          const values = columns.map((_, index) => `$${index + 1}`);
          const placeholders = columns.map((_, index) => row[columns[index]]);

          try {
            await primaryPool.query(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`,
              placeholders
            );
            inserted++;
          } catch (error: any) {
            console.error(`   ❌ Error inserting row into ${table}:`, error.message);
          }
        }

        console.log(`   ✅ ${table}: ${inserted} inserted, ${skipped} skipped`);
      } catch (error: any) {
        console.error(`   ❌ Error syncing ${table}:`, error.message);
      }
    }

    console.log('✅ Database sync completed!');
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}



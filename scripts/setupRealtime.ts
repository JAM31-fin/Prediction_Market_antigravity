import { dbQuery } from '../src/server/db';
import { logger } from '../src/server/logger';

async function configureRealtime() {
  logger.info('DB', 'Configuring Supabase Realtime replication & publications...');

  try {
    // 1. Ensure REPLICA IDENTITY FULL on public market tables
    await dbQuery('ALTER TABLE markets REPLICA IDENTITY FULL;');
    await dbQuery('ALTER TABLE market_outcomes REPLICA IDENTITY FULL;');
    await dbQuery('ALTER TABLE trades REPLICA IDENTITY FULL;');

    // 2. Add public tables to supabase_realtime publication if not already present
    const tables = ['markets', 'market_outcomes', 'trades'];
    for (const t of tables) {
      const check = await dbQuery(
        `SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = $1;`,
        [t]
      );
      if (check.rowCount === 0) {
        await dbQuery(`ALTER PUBLICATION supabase_realtime ADD TABLE ${t};`);
        logger.info('DB', `Added table "${t}" to supabase_realtime publication.`);
      } else {
        logger.info('DB', `Table "${t}" is already in supabase_realtime publication.`);
      }
    }

    // 3. Verify publication tables
    const res = await dbQuery(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`);
    logger.info('DB', 'Active Realtime publication tables:', {
      tables: res.rows.map((r: any) => r.tablename),
    });
  } catch (err: any) {
    logger.error('DB', `Error configuring Supabase Realtime publication: ${err.message}`);
    throw err;
  }
}

configureRealtime()
  .then(() => {
    console.log('Realtime replication configured successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to configure realtime:', err);
    process.exit(1);
  });

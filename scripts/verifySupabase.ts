import 'dotenv/config';
import { getDatabasePool, isPlaceholderDatabaseUrl, checkDatabaseHealth } from '../src/server/db';
import { logger } from '../src/server/logger';

async function verifySupabase() {
  console.log('\n======================================================');
  console.log('🔍 CENTRA MARKETS - SUPABASE & DATABASE AUDIT TOOL');
  console.log('======================================================\n');

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log('1. Configuration & Security Audit:');
  console.log('-----------------------------------');
  console.log(`• DATABASE_URL configured: ${dbUrl ? '✓ YES' : '✗ NO (Missing in .env)'}`);
  if (dbUrl && isPlaceholderDatabaseUrl(dbUrl)) {
    console.log('  ⚠️ WARNING: DATABASE_URL contains placeholder [YOUR-PASSWORD]!');
  }
  console.log(`• SUPABASE_URL configured: ${supabaseUrl ? '✓ YES' : '✗ NO'}`);
  console.log(`• SUPABASE_SECRET_KEY (Server Only): ${secretKey ? '✓ SECURED & PRESENT' : '✗ MISSING'}`);
  console.log(`• SUPABASE_PUBLISHABLE_KEY (Client Safe): ${publishableKey ? '✓ PRESENT' : '✗ MISSING'}`);
  console.log(`• SESSION_SECRET configured: ${process.env.SESSION_SECRET ? '✓ YES' : '⚠️ Using default salt'}`);

  console.log('\n2. Database Connectivity Test:');
  console.log('-----------------------------------');
  const pool = getDatabasePool();
  try {
    const pingRes = await pool.query('SELECT NOW() as now;');
    const row = pingRes.rows[0];
    const health = await checkDatabaseHealth();
    console.log(`• Engine Type: ${health.type === 'supabase_postgres' ? '🟢 Supabase PostgreSQL (Remote Cloud)' : '🟡 Local Embedded Engine (pg-mem)'}`);
    console.log(`• Server Timestamp: ${row?.now || new Date().toISOString()}`);

    if (health.type === 'supabase_postgres') {
      console.log('\n3. Supabase Schema & Row-Level Security (RLS) Status:');
      console.log('------------------------------------------------------');
      const rlsRes = await pool.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
      `);
      console.table(rlsRes.rows.map((r: any) => ({
        Table: r.tablename,
        'RLS Enabled': r.rowsecurity ? '✓ PROTECTED' : '✗ UNPROTECTED',
      })));

      console.log('\n4. Supabase Realtime Publication Status:');
      console.log('-----------------------------------------');
      const pubRes = await pool.query(`
        SELECT tablename 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
        ORDER BY tablename;
      `);
      console.table(pubRes.rows.map((r: any) => ({
        'Realtime Table': r.tablename,
        Replication: '✓ ACTIVE',
      })));

      console.log('\n5. Data Integrity Check:');
      console.log('-------------------------');
      const usersRes = await pool.query('SELECT COUNT(*) as count FROM users;');
      const marketsRes = await pool.query('SELECT COUNT(*) as count FROM markets;');
      const tradesRes = await pool.query('SELECT COUNT(*) as count FROM trades;');
      const tournsRes = await pool.query('SELECT COUNT(*) as count FROM tournaments;');
      console.log(`• Total Users: ${usersRes.rows[0]?.count}`);
      console.log(`• Total Markets: ${marketsRes.rows[0]?.count}`);
      console.log(`• Total Trades: ${tradesRes.rows[0]?.count}`);
      console.log(`• Total Tournaments: ${tournsRes.rows[0]?.count}`);
    } else {
      console.log('\n⚠️ Server is currently operating on fallback local in-memory PostgreSQL engine.');
      console.log('To connect to your cloud Supabase database, create a .env file with your DATABASE_URL.');
    }

    console.log('\n======================================================');
    console.log('✓ AUDIT FINISHED SUCCESSFULLY');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Database Connection Failed:', err.message);
    process.exit(1);
  }
}

verifySupabase();

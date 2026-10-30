import 'dotenv/config';
import { getDatabasePool, checkDatabaseHealth } from '../src/server/db';

async function listUsers() {
  console.log('\n======================================================');
  console.log('👥 USUARIOS REGISTRADOS EN CENTRA MARKETS');
  console.log('======================================================\n');

  try {
    const health = await checkDatabaseHealth();
    console.log(
      `• Base de Datos: ${
        health.type === 'supabase_postgres'
          ? '🟢 Supabase PostgreSQL (Remota en la Nube)'
          : '🟡 Motor Local en Memoria (pg-mem)'
      }\n`
    );

    const pool = getDatabasePool();
    const res = await pool.query(`
      SELECT 
        id, 
        username, 
        name, 
        email, 
        role, 
        ROUND(virtual_balance::numeric, 2) AS balance_usd, 
        created_at 
      FROM users 
      ORDER BY created_at ASC;
    `);

    if (res.rows.length === 0) {
      console.log('No se encontraron usuarios registrados en la base de datos.');
    } else {
      console.table(res.rows);
      console.log(`\nTotal de usuarios registrados: ${res.rows.length}`);
    }

    console.log('\n======================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error al consultar los usuarios:', err.message);
    process.exit(1);
  }
}

listUsers();

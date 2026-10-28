import dotenv from 'dotenv';
dotenv.config();
import { getDhcpLeases } from './src/mikrotik';
import { pool } from './src/db';

async function main() {
  try {
    console.log('Testing getDhcpLeases() directly...');
    const t0 = Date.now();
    const leases = await getDhcpLeases();
    console.log(`Fetched ${leases.length} in ${Date.now() - t0}ms`);
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e.message, e);
    process.exit(1);
  }
}

main();

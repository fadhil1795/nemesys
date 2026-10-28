import dotenv from 'dotenv';
dotenv.config();
import { CdataOltService } from './src/services/cdataOltService';

async function main() {
  console.log('Running syncMacTableAndLeases()...');
  const res = await CdataOltService.syncMacTableAndLeases();
  console.log('Result:', res);
  process.exit(0);
}

main();

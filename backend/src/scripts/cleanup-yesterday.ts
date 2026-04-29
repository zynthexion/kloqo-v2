import * as dotenv from 'dotenv';
import path from 'path';
// Load environment variables before initializing Firebase
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { container } from '../../src/infrastructure/webserver/express/Container';

async function run() {
  try {
    const clinicId = 'F9cIkgVcjXEfI7L63eoK';
    console.log(`Running manual cleanup for clinic: ${clinicId}`);
    const result = await container.endSessionCleanupUseCase.execute(clinicId);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

run();


import { apiRequest } from './lib/api-client'; // This is in clinic-admin

async function testFetch() {
  const doctorId = 'xjxVEmRCkWUTuQyYmPmQ';
  const dateStr = '2026-04-14';
  const clinicId = 'xjxVEmRCkWUTuQyYmPmQ'; // Testing with same ID
  
  try {
    const res = await fetch(`http://localhost:3001/api/doctors/${doctorId}/slots?date=${dateStr}&clinicId=${clinicId}`);
    const data = await res.json();
    console.log('Slots Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

testFetch();

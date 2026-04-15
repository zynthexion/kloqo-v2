
const admin = require('firebase-admin');

// Service account from .env (manually pasted for simplicity in this scratch script)
const serviceAccount = {
  "type": "service_account",
  "project_id": "kloqo-nurse-dup-43384903-8d386",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDfxMbcgKTDvLh+\nmix2kwglz6Z6R0vP34lOxGtU2ZIn7N+1RU+rPkxvuTRVZLxmUjfYfP3ZCWLLG/dH\nqLypMox8mLc46iIsexR86eda+iGsw9uRnLnBPebqN2lBWM4HqR6Zxl0aPlWsv3ZU\n/NR4IX74AhU624n76BLKMLgNPdqNyk/3+/9zZAzwWniyebsMnn/JPm0U44Pu2ykH\nmfendxqoktXsrwjk49JHdlF1D2lZiKALSdpIyFvOe48N/muwGVelVuAYG7EfA0Xn\n/2vKmnT0SaGQ5UKT4OudEijHm3dQWO5aMkLWVZb/lXXtW6xU4hXLrngXPRu8gR++\nFvaKZqUrAgMBAAECggEADFr06mEfN9n1JRn/XhizBXg+sySGo7BH1S9a1P3vNQC+\nPwFxuBah6WiESQbD5Es731psOPSf6m93EUZyDE5iaJ37pLF0BTK49RPqybov68/w\nqrL8CrB2GvT7Fp5mc3cId0/3MHP3dQ9cfRRstg/Bzyqf4EN8J4piQNAjb9yJDPUS\n7TF9DXZSk9eH5aCRur9qZNa3DP/Os9fumoCg9GFV1y4ZDhK90k4k4tGs3rhxkP5L\nDbCLFKbUfpHgyuEY7eyuFj54pSHaVsW2ALrlOhChPUShBT0Edm2LyHex/Y32uLcf\nF976620DeDKsxQXRMouIkqKAJ48cLz5YVOoNlM8swQKBgQDymdhI/YfBjTaU+e5l\nVsNdij9WKJbSXVEwJR7CePo0nPrPILdy7OT9hiTNiex1ujH3sA0zyEUQPZ/6Y6zE\nWnsC2db/RqH9QuUMCwQq3ZQqcU71ChQ8M3keIowaPrQq2Fb3DkG1q5UdYmETCJpf\nq/2yYd+DQpcS9pCdkSIpApfqiwKBgQDsIKkX3c08rLjbFCe2w9p1cGW/zICdGvPn\nQKCST3ouNjchgyfw2F/lB3yUNFYGGTqcW/HRXCuL0Sc9HRN7V+G1YdY89QLUrxsv\\ni6x10W4GZ65DLoJZQkgJf4qCeBj8Krx+Q/8uqiQe3F7Hg+QiFnQikfVbmwr+Ak36\ntS9fmgGj4QKBgQC+KIz6GZBRzIieGZId6PZV2clvlX0zA2ZiIJaNxRoKJ4oI1RI2\\niS2s83rhiVzJotsL1PlkP3SzGDrPn1WKy4lkYLA/hHPw+oBjAjeQCgLbidlkBTR7\\nQ7WKQ3YiFEhQ1SbFnG0xI39MexKwQqwOldfT/Ref4ZBdktskRuDJ2HiPpQKBgQDQ\\n/0uLg1eAR8TKrDlGjG3VGqoErKZ95/hQDCTTu6MCOhxr/iGhDHM8TXcX2ob1mOkG\\nsl8EFte4RmS7s/ulZbCykalFhPt/conWeIMqOTdwVd6pOgZHqOIH/iqDtncu40i5\\nXcgE7rVP12/Qmk2XWlZqrtQDw+Rj1Xhd2nbW4IJpIQKBgQC4nC5VfWPEYUJK+XPH\\n2UZFwfpAZrLEXS/h6DKke7VCVwRP6eet4GHaRJApcfjJ1WIhWMHcZVdG6sR4sxLl\\nttMfA7i9rPhCYZ+9gefrBaBhzjboL39tyIDeHG/nGlS37gGLKXsHjt570nGnJAOB\\npE7J8j6QdB1Jtdl3RAQyivpPWA==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@kloqo-nurse-dup-43384903-8d386.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDoctor() {
  const doctorId = "xjxVEmRCkWUTuQyYmPmQ"; 
  const doc = await db.collection('doctors').doc(doctorId).get();
  if (!doc.exists) {
    console.log('Doctor not found');
    return;
  }
  const data = doc.data();
  console.log('--- Doctor Check ---');
  console.log('Name:', data.name);
  console.log('Availability:', JSON.stringify(data.availabilitySlots || [], null, 2));
  console.log('Overrides:', JSON.stringify(data.dateOverrides || {}, null, 2));
  process.exit(0);
}

checkDoctor().catch(e => { console.error(e); process.exit(1); });

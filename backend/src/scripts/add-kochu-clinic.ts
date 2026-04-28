import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

const clinicData = {
  "id": "FxJvKbeZutWOhXxQgySH",
  "clinicId": "FxJvKbeZutWOhXxQgySH",
  "ownerId": "5huD4v9ilZTYaVhbO0406MuW2m23",
  "name": "Kochu S Mani Clinic",
  "type": "Clinic",
  "address": "Casa Mia , Opp. Key Cee Movies, Pattambi Road, Perinthalmanna, Malappuram, Kerala, 679322",
  "addressDetails": {
    "line1": "Casa Mia , Opp. Key Cee Movies",
    "line2": "Pattambi Road",
    "city": "Perinthalmanna",
    "district": "Malappuram",
    "state": "Kerala",
    "pincode": "679322"
  },
  "plan": "Free Plan (Beta)",
  "billingCycle": "annually",
  "hardwareChoice": "byot",
  "calculatedMonthlyTotal": 0,
  "calculatedOneTimeTotal": 0,
  "plannedUpfrontTotal": 0,
  "ownerEmail": "kochusmani49@gmail.com",
  "latitude": 10.969315867212966,
  "longitude": 76.22729692792747,
  "walkInTokenAllotment": 5,
  "numDoctors": 1,
  "clinicRegNumber": "",
  "mapsLink": "",
  "logoUrl": "https://storage.googleapis.com/kloqo-clinic-multi-33968-4c50b.firebasestorage.app/clinics/5huD4v9ilZTYaVhbO0406MuW2m23/documents/logo",
  "licenseUrl": "https://storage.googleapis.com/kloqo-clinic-multi-33968-4c50b.firebasestorage.app/clinics/5huD4v9ilZTYaVhbO0406MuW2m23/documents/license",
  "receptionPhotoUrl": "https://storage.googleapis.com/kloqo-clinic-multi-33968-4c50b.firebasestorage.app/clinics/5huD4v9ilZTYaVhbO0406MuW2m23/documents/reception_photo",
  "planStartDate": {
    "_seconds": 1767616970,
    "_nanoseconds": 126000000
  },
  "registrationStatus": "Approved",
  "departments": [
    "dept-08"
  ],
  "currentDoctorCount": 1,
  "onboardingStatus": "Completed",
  "tokenDistribution": "classic",
  "genderPreference": "Women",
  "showEstimatedWaitTime": false,
  "operatingHours": [
    {
      "day": "Monday",
      "timeSlots": [
        { "open": "08:30", "close": "09:30" },
        { "open": "15:30", "close": "19:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Tuesday",
      "timeSlots": [
        { "open": "15:30", "close": "18:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Wednesday",
      "timeSlots": [
        { "open": "08:30", "close": "09:30" },
        { "open": "15:30", "close": "18:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Thursday",
      "timeSlots": [
        { "open": "08:30", "close": "09:30" },
        { "open": "15:30", "close": "18:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Friday",
      "timeSlots": [
        { "open": "08:30", "close": "09:30" },
        { "open": "15:31", "close": "18:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Saturday",
      "timeSlots": [
        { "open": "08:30", "close": "09:30" },
        { "open": "15:30", "close": "18:30" }
      ],
      "isClosed": false
    },
    {
      "day": "Sunday",
      "timeSlots": [],
      "isClosed": true
    }
  ],
  "isDeleted": false,
  "createdAt": {
    "_seconds": 1767616970,
    "_nanoseconds": 126000000
  },
  "updatedAt": {
    "_seconds": 1777431358,
    "_nanoseconds": 0
  },
  "trialEndDate": {
    "_seconds": 1799152970,
    "_nanoseconds": 126000000
  },
  "subscriptionDetails": {
    "subscriptionId": null,
    "subscriptionStatus": "active",
    "renewalType": "manual-upi",
    "isTrialPeriod": true,
    "nextBillingDate": {
      "_seconds": 1799152970,
      "_nanoseconds": 126000000
    },
    "lastPaymentDate": null,
    "gracePeriodEndDate": null,
    "failureReason": null
  },
  "usage": {
    "whatsapp": {
      "monthlyLimit": 200,
      "currentMonthCount": 0,
      "totalEverSent": 0,
      "isUnlimited": false,
      "lastMessageAt": null,
      "nextResetDate": {
        "_seconds": 1777852800,
        "_nanoseconds": 0
      },
      "additionalCredits": 0
    }
  }
};

async function addClinic() {
  try {
    const convertTimestamp = (obj: any) => {
      if (obj && typeof obj._seconds === 'number') {
        return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds || 0);
      }
      return obj;
    };

    const finalData = {
      ...clinicData,
      planStartDate: convertTimestamp(clinicData.planStartDate),
      createdAt: convertTimestamp(clinicData.createdAt),
      updatedAt: convertTimestamp(clinicData.updatedAt),
      trialEndDate: convertTimestamp(clinicData.trialEndDate),
      subscriptionDetails: clinicData.subscriptionDetails ? {
        ...clinicData.subscriptionDetails,
        nextBillingDate: convertTimestamp(clinicData.subscriptionDetails.nextBillingDate),
        lastPaymentDate: convertTimestamp(clinicData.subscriptionDetails.lastPaymentDate),
        gracePeriodEndDate: convertTimestamp(clinicData.subscriptionDetails.gracePeriodEndDate),
      } : undefined,
      usage: clinicData.usage?.whatsapp ? {
        whatsapp: {
          ...clinicData.usage.whatsapp,
          nextResetDate: convertTimestamp(clinicData.usage.whatsapp.nextResetDate),
          lastMessageAt: convertTimestamp(clinicData.usage.whatsapp.lastMessageAt),
        }
      } : undefined
    };

    await db.collection('clinics').doc(finalData.id).set(finalData);
    console.log(`✅ Successfully added clinic "${finalData.name}" (${finalData.id}) to V2 database.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add clinic:', error);
    process.exit(1);
  }
}

addClinic();

import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

const doctorData = {
  "id": "doc-1767617650281-leqmk7hfy",
  "userId": "XUy3aWRHPiP7dFtpBKXezDhEEo32",
  "email": "kochusmani49@gmail.com",
  "clinicId": "FxJvKbeZutWOhXxQgySH",
  "name": "Dr. Kochu S Mani",
  "latitude": 10.969315867212966,
  "longitude": 76.22729692792747,
  "photo": {},
  "availabilityExtensions": {},
  "specialty": "Consultant Gynaecologist & Laproscopic Surgeon",
  "bio": "MBBS.DGO.\nChief Gynaecologist & Laproscopic Surgeon\nEMS Memorial Co-operative Hospital\nPerinthalmanna\nKochu S Mani Clinic is a highly qualified gynecologist providing comprehensive women's healthcare services. Expert care in obstetrics, gynecology, and women's health with a focus on patient comfort and advanced medical care.",
  "avatar": "https://storage.googleapis.com/kloqo-clinic-multi-33968-4c50b.firebasestorage.app/doctor_avatars/FxJvKbeZutWOhXxQgySH/1767617649273_blob",
  "experience": 35,
  "department": "OB/GYN",
  "consultationFee": 300,
  "averageConsultingTime": 5,
  "freeFollowUpDays": 7,
  "advanceBookingDays": 4,
  "registrationNumber": "",
  "consultationStatus": "Out",
  "availability": "Unavailable",
  "gracePeriodMinutes": 15,
  "walkInReserveRatio": 0.15,
  "tokenDistribution": "classic",
  "walkInTokenAllotment": 5,
  "schedule": "Sunday: 08:30 AM-12:00 PM; Monday: 08:30 AM-09:30 AM, 03:30 PM-06:30 PM; Tuesday: 03:30 PM-06:30 PM; Wednesday: 08:30 AM-09:30 AM, 03:30 PM-06:30 PM; Thursday: 08:30 AM-09:30 AM, 03:30 PM-06:30 PM; Friday: 03:30 PM-06:30 PM; Saturday: 08:30 AM-09:30 AM, 03:30 PM-06:30 PM",
  "availabilitySlots": [
    {
      "day": "Sunday",
      "timeSlots": [
        { "from": "08:30", "to": "12:00" }
      ]
    },
    {
      "day": "Monday",
      "timeSlots": [
        { "from": "08:30", "to": "09:30" },
        { "from": "15:30", "to": "18:30" }
      ]
    },
    {
      "day": "Tuesday",
      "timeSlots": [
        { "from": "15:30", "to": "18:30" }
      ]
    },
    {
      "day": "Wednesday",
      "timeSlots": [
        { "from": "08:30", "to": "09:30" },
        { "from": "15:30", "to": "18:30" }
      ]
    },
    {
      "day": "Thursday",
      "timeSlots": [
        { "from": "08:30", "to": "09:30" },
        { "from": "15:30", "to": "18:30" }
      ]
    },
    {
      "day": "Friday",
      "timeSlots": [
        { "from": "15:30", "to": "18:30" }
      ]
    },
    {
      "day": "Saturday",
      "timeSlots": [
        { "from": "08:30", "to": "09:30" },
        { "from": "15:30", "to": "18:30" }
      ]
    }
  ],
  "dateOverrides": {},
  "breakPeriods": {},
  "rating": 4.115384615384615,
  "reviews": 26,
  "reviewList": [
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientId": "x09ks0YZ4qF3wyvLaUAd",
      "rating": 5,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "id": "hWQp8iMFcZxhEiVxAUqF",
      "appointmentId": "e5aGTr60msuxGN7Srtsy",
      "doctorName": "Dr. Kochu S Mani",
      "createdAt": { "_seconds": 1769011821, "_nanoseconds": 598000000 },
      "feedback": "",
      "patientName": "Dilna"
    },
    {
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "MIl9o1Yqw1btwisIXpxl",
      "createdAt": { "_seconds": 1770199891, "_nanoseconds": 472000000 },
      "id": "2gnWw5hy3qH7swRX5KUm",
      "feedback": "",
      "patientName": "Sreelakshmi",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "rating": 5,
      "patientId": "tVfL6C8ENc0IEi9FuCLg",
      "doctorId": "doc-1767617650281-leqmk7hfy"
    },
    {
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "rating": 4,
      "patientId": "QSfm5lzY4L6fSCFUUtAz",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientName": "Kavyakrishna",
      "feedback": "",
      "id": "K5pyOqFUq5klocemivdh",
      "createdAt": { "_seconds": 1770217200, "_nanoseconds": 255000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "zKzRrjsYSCwZp6os3e4R"
    },
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "rating": 5,
      "patientId": "tVfL6C8ENc0IEi9FuCLg",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "createdAt": { "_seconds": 1771494509, "_nanoseconds": 578000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "C88nsfAXhHHS2T0VHJLl",
      "id": "SR9ZeDgANvoX3Xsvj4ls",
      "patientName": "Sreelakshmi",
      "feedback": ""
    },
    {
      "feedback": "",
      "patientName": "Sreelakshmi",
      "id": "Ol2owLhbbO6QxgF5mxu8",
      "appointmentId": "97wbN53IUBVrx75RjxML",
      "doctorName": "Dr. Kochu S Mani",
      "createdAt": { "_seconds": 1771501375, "_nanoseconds": 994000000 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "tVfL6C8ENc0IEi9FuCLg",
      "rating": 5,
      "clinicId": "FxJvKbeZutWOhXxQgySH"
    },
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "rating": 5,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "JVZbtBE6DG4uwTGRHFgT",
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "IJdcHJD6KRrZOQ7EZ8cL",
      "createdAt": { "_seconds": 1771823798, "_nanoseconds": 799000000 },
      "id": "1hEtshSFFHzc7im7zPPb",
      "feedback": "നല്ല ഡോക്ടർ ആണ് നമുക്ക് ഒരുവകുഴപ്പവും ഉണ്ടായിട്ടില്ല",
      "patientName": "Vahidha"
    },
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "rating": 5,
      "patientId": "fsld2uH0IR2rGJqOL8aw",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "createdAt": { "_seconds": 1772626640, "_nanoseconds": 973000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "w4DgdKAWCbWkoV4EWWod",
      "id": "YxXtUFo2hDO8Fu0AEnlE",
      "patientName": "Sinu",
      "feedback": ""
    },
    {
      "rating": 1,
      "patientId": "J3iCMq2ye7Vn8GvBykgR",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientName": "Akshaya",
      "feedback": "",
      "createdAt": { "_seconds": 1772726608, "_nanoseconds": 349000000 },
      "appointmentId": "HOUeuZdtsf6l0y75GXFj",
      "doctorName": "Dr. Kochu S Mani",
      "id": "PBfmz6rCrNskGMBWTIlY"
    },
    {
      "feedback": "",
      "patientName": "Reshma",
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "1cWjF0uQgOr9Iivq50cJ",
      "createdAt": { "_seconds": 1772783461, "_nanoseconds": 157000000 },
      "id": "76QEsRNlhuEyCmz4PQP8",
      "patientId": "oN8ZwRXLHjxirPDMgWLK",
      "rating": 4,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "clinicId": "FxJvKbeZutWOhXxQgySH"
    },
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "OVPvMkMw7V9yQZtxnjpj",
      "rating": 5,
      "appointmentId": "E5FMJk907UrlFv4BZxi5",
      "doctorName": "Dr. Kochu S Mani",
      "createdAt": { "_seconds": 1772792915, "_nanoseconds": 868000000 },
      "id": "L5IaccGXJYMMTyEheEYa",
      "feedback": "",
      "patientName": "Irfana"
    },
    {
      "feedback": "",
      "patientName": "Niranjana",
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "w7c9F2Zjc0EyfLUUhTxv",
      "createdAt": { "_seconds": 1772861408, "_nanoseconds": 305000000 },
      "id": "Tvbm6yTGiDr1iIAJstpJ",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "rating": 1,
      "patientId": "Uj7a28grGIcaAxC53euW",
      "clinicId": "FxJvKbeZutWOhXxQgySH"
    },
    {
      "patientId": "dPug4txBtLXPOjKi0pqo",
      "rating": 5,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientName": "Bareera",
      "feedback": "",
      "createdAt": { "_seconds": 1773024986, "_nanoseconds": 530000000 },
      "appointmentId": "6pHVc1g3SxGhFtnfXnmM",
      "doctorName": "Dr. Kochu S Mani",
      "id": "eAUMkUv7X0YrHGJASWxb"
    },
    {
      "feedback": "",
      "patientName": "Vijisha",
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "QxRH3bbpQcp6sPzaPGbA",
      "createdAt": { "_seconds": 1773116096, "_nanoseconds": 310000000 },
      "id": "0q76bJkgSH9pNvzd01cu",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "rating": 5,
      "patientId": "VdR8UBMnz6Zt8uCeQDS7",
      "clinicId": "FxJvKbeZutWOhXxQgySH"
    },
    {
      "id": "slsDnWWQB76Xq5K8ATTJ",
      "createdAt": { "_seconds": 1773149504, "_nanoseconds": 546000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "6vj1AkhvptB3ydvWHJT4",
      "patientName": "Bareera",
      "feedback": "",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "dPug4txBtLXPOjKi0pqo",
      "rating": 5
    },
    {
      "rating": 5,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "Nxesir8Y5duKtOVaciXU",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "feedback": "",
      "patientName": "Divya",
      "appointmentId": "sZPH4Hl611RJsbjKR4s7",
      "doctorName": "Dr. Kochu S Mani",
      "createdAt": { "_seconds": 1773226683, "_nanoseconds": 49000000 },
      "id": "QH1jjXUdIXUy5NgtKsgf"
    },
    {
      "patientId": "Nxesir8Y5duKtOVaciXU",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "rating": 5,
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientName": "Divya",
      "feedback": "",
      "createdAt": { "_seconds": 1773231383, "_nanoseconds": 451000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "6Lse21yCnZhFbLHzsYvd",
      "id": "Y4pqoSvpvlx3VvDqGcQS"
    },
    {
      "rating": 2,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "patientId": "TMZahefFz6t6WbTHbcmm",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientName": "Nasira",
      "feedback": "",
      "id": "HiUOcK4q3k6ZgIV48LiM",
      "createdAt": { "_seconds": 1773487596, "_nanoseconds": 971000000 },
      "appointmentId": "KRew8ftSfd5wu7DnuLwD",
      "doctorName": "Dr. Kochu S Mani"
    },
    {
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "rating": 5,
      "patientId": "ayiimVQMgRLnFokMdow8",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "feedback": "",
      "patientName": "Raihanath",
      "id": "ND6EegvtF0s71DpKdc0U",
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "yAxA6i7W6cmUFl3hpVnk",
      "createdAt": { "_seconds": 1773650027, "_nanoseconds": 954000000 }
    },
    {
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "patientId": "y7uxxBbLAgQz57khb36k",
      "rating": 3,
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "id": "TeOxJfBgBt8SMjvU9r00",
      "createdAt": { "_seconds": 1773857808, "_nanoseconds": 451000000 },
      "doctorName": "Dr. Kochu S Mani",
      "appointmentId": "DyeTtPEnpVsRPb2gswpB",
      "patientName": "Fathimathasni",
      "feedback": ""
    },
    {
      "id": "a9MBEwTSq0tJM9f5y0hP",
      "appointmentId": "mF43o536oO3QB61CVp2G",
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "patientId": "dPug4txBtLXPOjKi0pqo",
      "patientName": "Bareera",
      "rating": 5,
      "feedback": "",
      "createdAt": { "_seconds": 1774091609, "_nanoseconds": 832000000 },
      "clinicId": "FxJvKbeZutWOhXxQgySH"
    },
    {
      "id": "uzXORNi2L4fwFoYUCSyU",
      "appointmentId": "R5hh1018nQnlfK4U1POV",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1774437852, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "",
      "patientId": "LwLdSdUf3vrfEmIpNXgR",
      "patientName": "Sajna",
      "rating": 2
    },
    {
      "id": "sONGxLPlE3EiA5ebLKEo",
      "appointmentId": "sJVjDV4kQNesI7du04rw",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1774521140, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "ഗുഡ്",
      "patientId": "QSfm5lzY4L6fSCFUUtAz",
      "patientName": "Kavyakrishna",
      "rating": 4
    },
    {
      "id": "Ut9vHpOE0dWglL7P9z7I",
      "appointmentId": "nWNtc5IoP8tpAc0C4U9y",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1775034829, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "Good",
      "patientId": "zBJcfcJErQN87WQQUixC",
      "patientName": "Vijitha",
      "rating": 1
    },
    {
      "id": "ZcNTTbZkvPn4I4CMqdbH",
      "appointmentId": "vmegz59F8ey4GBkpWHST",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1775457862, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "",
      "patientId": "QSfm5lzY4L6fSCFUUtAz",
      "patientName": "Kavyakrishna",
      "rating": 5
    },
    {
      "id": "n11fHTWTockHtaVq81fc",
      "appointmentId": "Kr38aLcxYzYva6smKHeU",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1776166543, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "",
      "patientId": "tVfL6C8ENc0IEi9FuCLg",
      "patientName": "Sreelakshmi",
      "rating": 5
    },
    {
      "id": "b2GKDgLVNQwxIBPe6lCn",
      "appointmentId": "UTmAGwazJ1ZG6KXzMMvQ",
      "clinicId": "FxJvKbeZutWOhXxQgySH",
      "createdAt": { "_seconds": 1776342565, "_nanoseconds": 0 },
      "doctorId": "doc-1767617650281-leqmk7hfy",
      "doctorName": "Dr. Kochu S Mani",
      "feedback": "",
      "patientId": "3lGHpzrAhd2nNGYVKe5x",
      "patientName": "Neethu",
      "rating": 5
    }
  ],
  "updatedAt": {
    "_seconds": 1777299295,
    "_nanoseconds": 0
  }
};

async function addDoctor() {
  try {
    const convertTimestamp = (obj: any) => {
      if (obj && typeof obj._seconds === 'number') {
        return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds || 0);
      }
      return obj;
    };

    const finalData = {
      ...doctorData,
      updatedAt: convertTimestamp(doctorData.updatedAt),
      reviewList: doctorData.reviewList.map(review => ({
        ...review,
        createdAt: convertTimestamp(review.createdAt)
      }))
    };

    await db.collection('doctors').doc(finalData.id).set(finalData);
    console.log(`✅ Successfully added doctor "${finalData.name}" (${finalData.id}) to V2 database.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add doctor:', error);
    process.exit(1);
  }
}

addDoctor();

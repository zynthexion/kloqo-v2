import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { Clinic, User, KLOQO_ROLES, KloqoRole, RBACUtils } from '../../../packages/shared/src/index';
import { IEmailService, IClinicRepository } from '../domain/repositories';

export interface RegisterClinicParams {
  clinicData: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'registrationStatus' | 'onboardingStatus'>;
  adminData: {
    email: string;
    password?: string;
    name: string;
    phone: string;
    designation: 'Doctor' | 'Owner';
  };
  paymentDetails?: {
    paymentId: string;
    orderId: string;
    signature: string;
  };
}

export class RegisterClinicUseCase {
  constructor(
    private emailService?: IEmailService // Made optional for backward compatibility if needed, but will be provided in index.ts
  ) {}

  async execute(params: RegisterClinicParams): Promise<{ clinicId: string; adminId: string }> {
    const { clinicData, adminData, paymentDetails } = params;

    // Verify Razorpay signature if payment was made
    if (paymentDetails) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
      const body = paymentDetails.orderId + "|" + paymentDetails.paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== paymentDetails.signature) {
        throw new Error('Invalid payment signature. Registration aborted.');
      }
    }
    
    // 1. Create Firebase Auth User
    let adminUid: string;
    let isNewAuthUser = false;
    try {
      const authUser = await admin.auth().createUser({
        email: adminData.email,
        password: adminData.password,
        displayName: adminData.name,
        phoneNumber: adminData.phone,
      });
      adminUid = authUser.uid;
      isNewAuthUser = true;
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        const existingUser = await admin.auth().getUserByEmail(adminData.email);
        adminUid = existingUser.uid;
      } else {
        throw error;
      }
    }

    // 2. Prepare Firestore IDs
    const clinicRef = admin.firestore().collection('clinics').doc();
    const clinicId = clinicRef.id;
    const userRef = admin.firestore().collection('users').doc(adminUid);

    // 3. Prepare Clinic Record
    // Determine WhatsApp Usage Limit based on Plan
    const selectedPlan = (clinicData as any).plan || 'Free Plan (Beta)';
    let monthlyLimit = 0;
    let isUnlimited = false;

    if (selectedPlan.toLowerCase().includes('999') || selectedPlan.toLowerCase().includes('starter')) {
      monthlyLimit = 2000;
      isUnlimited = false;
    } else if (selectedPlan.toLowerCase().includes('pro') || selectedPlan.toLowerCase().includes('growth') || selectedPlan.toLowerCase().includes('custom')) {
      monthlyLimit = 0;
      isUnlimited = true;
    } else {
      // Free / Default Sandbox
      monthlyLimit = 200; // Sensible default for trials
      isUnlimited = false;
    }

    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(now.getDate() + 30); // 30-day free trial for all plans
    const nextResetDate = trialEndDate; // WhatsApp resets exactly when billing cycle rolls over

    const newClinic: Clinic = {
        ...(clinicData as any),
        id: clinicId,
        clinicId: clinicId, // Explicitly tracking clinicId inside the document
        ownerId: adminUid,
        registrationStatus: 'Pending',
        onboardingStatus: 'Pending',
        createdAt: now,
        updatedAt: now,
        currentDoctorCount: 0,
        departments: [],
        plannedUpfrontTotal: (clinicData as any).plannedUpfrontTotal,
        addressDetails: clinicData.addressDetails || {
            line1: '',
            city: '',
            state: '',
            pincode: ''
        },
        walkInTokenAllotment: (clinicData as any).walkInTokenAllotment || 5,
        walkInReserveRatio: (clinicData as any).walkInReserveRatio || 0.15,
        gracePeriodMinutes: (clinicData as any).gracePeriodMinutes || 15,
        showEstimatedWaitTime: (clinicData as any).showEstimatedWaitTime !== undefined ? (clinicData as any).showEstimatedWaitTime : true,
        tokenDistribution: (clinicData as any).tokenDistribution || 'classic',
        trialEndDate: trialEndDate, // Saved strictly for proration and sync logic
        subscriptionDetails: {
          subscriptionId: null, // Captured later during 'Trial to Paid' conversion
          subscriptionStatus: 'active',
          renewalType: (clinicData as any).billingCycle === 'annually' ? 'manual-upi' : 'auto-debit', // Will trigger checkout flow if auto-debit and no sub ID yet
          isTrialPeriod: true,
          nextBillingDate: trialEndDate,
          lastPaymentDate: paymentDetails ? now : null,
          gracePeriodEndDate: null,
          failureReason: null
        },
        usage: {
          whatsapp: {
            monthlyLimit,
            currentMonthCount: 0,
            totalEverSent: 0,
            isUnlimited,
            lastMessageAt: null,
            nextResetDate,
            additionalCredits: 0
          }
        },
        isDeleted: false,
        ...(params.paymentDetails ? { paymentDetails: params.paymentDetails } : {})
    };

    // 4. Prepare User Record & Execute Batch
    const userSnapshot = await userRef.get();
    const existingUserData = userSnapshot.exists ? userSnapshot.data() : null;

    const mergedRoles = Array.from(new Set([
      ...(existingUserData?.roles || (existingUserData?.role ? [existingUserData.role] : [])),
      KLOQO_ROLES.CLINIC_ADMIN
    ])).filter(Boolean) as KloqoRole[];

    const newUser: Partial<User> = {
        id: adminUid,
        uid: adminUid,
        email: adminData.email,
        name: adminData.name,
        phone: adminData.phone,
        role: KLOQO_ROLES.CLINIC_ADMIN, // Primary role for this app context
        roles: mergedRoles,
        clinicId: clinicId,
        updatedAt: new Date(),
        isDeleted: false
    };

    // Only set createdAt if it's a fresh user record
    if (!existingUserData) {
      newUser.createdAt = new Date();
    }

    const batch = admin.firestore().batch();
    batch.set(clinicRef, newClinic);
    batch.set(userRef, newUser, { merge: true });

    await batch.commit();

    // 6. Send Credentials Email if new user and email service is available
    if (isNewAuthUser && this.emailService && adminData.password) {
      try {
        await this.emailService.sendCredentials(
          adminData.email,
          adminData.name,
          adminData.password,
          KLOQO_ROLES.CLINIC_ADMIN,
          newClinic.name
        );
      } catch (emailError) {
        console.error('Failed to send welcome email to clinic owner:', emailError);
        // We don't fail the registration if email fails
      }
    }

    return { clinicId, adminId: adminUid };
  }
}

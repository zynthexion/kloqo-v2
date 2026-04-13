import { IClinicRepository } from '../domain/repositories';
import crypto from 'crypto';

export class VerifySubscriptionUpgradeUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(clinicId: string, paymentDetails: any, newSettings: any): Promise<void> {
    // 1. Verify Payment Signature
    if (paymentDetails && paymentDetails.amount > 0) {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error('Invalid payment details. Signature verification failed.');
      }
      
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) throw new Error('Razorpay secret not configured');

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
      
      if (expectedSignature !== razorpay_signature) {
        throw new Error('Invalid payment signature. Potential spoofing attempt.');
      }
    }

    // 2. Delegate to the Repository to handle the Transaction AND the Cache
    // We pass the paymentDetails.amount down so the repository can verify the math natively.
    await this.clinicRepo.upgradeSubscriptionWithTransaction(
      clinicId, 
      newSettings, 
      paymentDetails?.amount || 0
    );
  }
}

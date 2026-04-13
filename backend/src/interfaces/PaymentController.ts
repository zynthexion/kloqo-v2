import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import { VerifySubscriptionUpgradeUseCase } from '../application/VerifySubscriptionUpgradeUseCase';
import { ConfirmAppointmentPaymentUseCase } from '../application/ConfirmAppointmentPaymentUseCase';

export class PaymentController {
  private razorpay: Razorpay;

  constructor(
    private confirmAppointmentPaymentUseCase: ConfirmAppointmentPaymentUseCase,
    private verifySubscriptionUpgradeUseCase?: VerifySubscriptionUpgradeUseCase
  ) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });
  }

  async verifyUpgrade(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: missing clinicId' });
      }

      const { paymentDetails, newSettings } = req.body;
      
      if (!this.verifySubscriptionUpgradeUseCase) {
        throw new Error('VerifySubscriptionUpgradeUseCase not injected');
      }

      await this.verifySubscriptionUpgradeUseCase.execute(clinicId, paymentDetails, newSettings);

      res.status(200).json({ success: true, message: 'Upgrade verified and applied' });
    } catch (error: any) {
      console.error('Error verifying upgrade:', error);
      res.status(500).json({ error: error.message || 'Failed to verify upgrade' });
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const { amount, currency = 'INR', receipt } = req.body;

      if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
      }

      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
      };

      const order = await this.razorpay.orders.create(options);
      res.status(200).json(order);
    } catch (error: any) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  }

  async verifyPayment(req: Request, res: Response) {
    try {
      const { appointmentId, paymentDetails } = req.body;
      if (!appointmentId || !paymentDetails) {
        return res.status(400).json({ error: 'appointmentId and paymentDetails are required' });
      }

      await this.confirmAppointmentPaymentUseCase.execute({ appointmentId, paymentDetails });
      res.status(200).json({ success: true, message: 'Payment confirmed and appointment status updated.' });
    } catch (error: any) {
      console.error('Error confirming appointment payment:', error);
      res.status(500).json({ error: error.message || 'Payment confirmation failed' });
    }
  }
}

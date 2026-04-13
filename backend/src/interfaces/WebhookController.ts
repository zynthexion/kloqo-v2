import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { FirebaseSubscriptionRepository } from '../infrastructure/firebase/FirebaseSubscriptionRepository';
import { FirebaseClinicRepository } from '../infrastructure/firebase/FirebaseClinicRepository';

export class WebhookController {
  constructor(
    private subscriptionRepo: FirebaseSubscriptionRepository,
    private clinicRepo: FirebaseClinicRepository,
  ) {}

  /** POST /webhooks/razorpay — handles subscription lifecycle events */
  async handleRazorpay(req: Request, res: Response) {
    try {
      // 1. Verify webhook signature
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
      const signature = req.headers['x-razorpay-signature'] as string;

      if (secret && signature) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (expectedSig !== signature) {
          console.warn('Razorpay webhook: invalid signature');
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      const event = req.body;
      const eventType: string = event.event;

      console.log(`Razorpay webhook received: ${eventType}`);

      if (eventType === 'subscription.charged') {
        await this.handleSubscriptionCharged(event.payload?.subscription?.entity);
      } else if (eventType === 'subscription.cancelled') {
        await this.handleSubscriptionStatusChange(event.payload?.subscription?.entity, 'cancelled');
      } else if (eventType === 'subscription.halted') {
        await this.handleSubscriptionStatusChange(event.payload?.subscription?.entity, 'past_due');
      } else if (eventType === 'subscription.activated') {
        await this.handleSubscriptionStatusChange(event.payload?.subscription?.entity, 'active');
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Razorpay webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  private async handleSubscriptionCharged(subscriptionData: any) {
    if (!subscriptionData?.id) return;

    const sub = await this.subscriptionRepo.findByRazorpaySubscriptionId(subscriptionData.id);
    if (!sub) {
      console.warn(`No local subscription found for razorpayId: ${subscriptionData.id}`);
      return;
    }

    // Push currentPeriodEnd forward by 30 days
    const newPeriodEnd = new Date();
    newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

    await this.subscriptionRepo.update(sub.id, {
      status: 'active',
      currentPeriodEnd: newPeriodEnd,
    });

    // Also update clinic's subscriptionDetails
    if (sub.clinicId) {
      await this.clinicRepo.update(sub.clinicId, {
        'subscriptionDetails.subscriptionStatus': 'active',
        'subscriptionDetails.nextBillingDate': newPeriodEnd,
        'subscriptionDetails.lastPaymentDate': new Date(),
        'subscriptionDetails.isTrialPeriod': false, // Ensure trial is flipped upon real payment
      } as any);
    }

    console.log(`Subscription renewed for clinic ${sub.clinicId} until ${newPeriodEnd.toISOString()}`);
  }

  private async handleSubscriptionStatusChange(subscriptionData: any, status: 'cancelled' | 'past_due' | 'active') {
    if (!subscriptionData?.id) return;

    const sub = await this.subscriptionRepo.findByRazorpaySubscriptionId(subscriptionData.id);
    if (!sub) return;

    await this.subscriptionRepo.update(sub.id, { status });

    if (sub.clinicId) {
      await this.clinicRepo.update(sub.clinicId, {
        'subscriptionDetails.subscriptionStatus': status,
      } as any);
    }

    console.log(`Subscription status → ${status} for clinic ${sub.clinicId}`);
  }
}

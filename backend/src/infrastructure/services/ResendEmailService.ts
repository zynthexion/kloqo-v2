import { Resend } from 'resend';
import { IEmailService } from '../../domain/repositories';
import { KLOQO_ROLES } from '@kloqo/shared';

export class ResendEmailService implements IEmailService {
  private resend: Resend;
  private fromEmail = 'Kloqo <onboarding@resend.dev>'; // Using Resend's default testing domain or a verified one if provided in env

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
    // If a custom from email is provided in env, use it
    if (process.env.RESEND_FROM_EMAIL) {
      this.fromEmail = process.env.RESEND_FROM_EMAIL;
    }
  }

  async sendCredentials(email: string, name: string, password: string, role: string, clinicName?: string): Promise<void> {
    const subject = clinicName 
      ? `Welcome to ${clinicName} on Kloqo`
      : 'Welcome to Kloqo - Your Account Credentials';

    const roleDisplayName = role === KLOQO_ROLES.NURSE ? 'Staff/Doctor' : role;
    const loginUrl = 'https://clinic-admin.kloqo.com'; // Adjust based on production URL

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
        <h2 style="color: #2563eb;">Welcome to Kloqo!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>An account has been created for you as a <strong>${roleDisplayName}</strong> ${clinicName ? `at <strong>${clinicName}</strong>` : ''}.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Your Login Credentials:</strong></p>
          <p style="margin: 10px 0 5px 0;">Email: <code style="background: #fff; padding: 2px 5px; border-radius: 3px;">${email}</code></p>
          <p style="margin: 0;">Password: <code style="background: #fff; padding: 2px 5px; border-radius: 3px;">${password}</code></p>
        </div>

        <p>You will be required to change your password upon your first login.</p>
        
        <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Login to Dashboard</a>
        
        <p style="margin-top: 30px; font-size: 0.875rem; color: #6b7280;">
          If you have any questions, please contact your clinic administrator.
          <br><br>
          Best regards,<br>
          The Kloqo Team
        </p>
      </div>
    `;

    try {
      console.log(`[ResendEmailService] Sending email to ${email} with subject: "${subject}"...`);
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: subject,
        html: html,
      });

      if (error) {
        console.error('[ResendEmailService] Resend API Validation/Send Error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log(`[ResendEmailService] Credentials email successfully queued/sent to ${email}. Resend ID: ${data?.id}`);
    } catch (error: any) {
      console.error('[ResendEmailService] Exception caught during sendCredentials:', error);
      // We don't necessarily want to fail the whole process if email fails, 
      // but let's at least log it or throw depending on requirements.
      throw error;
    }
  }
}

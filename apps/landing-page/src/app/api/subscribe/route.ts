import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@zynthexion.com';

    if (!apiKey || apiKey === 're_your_api_key_here') {
      console.warn('⚠️ RESEND_API_KEY is not configured. Running in Mock Mode.');
      return NextResponse.json({
        success: true,
        message: 'Successfully registered interest! (Developer Mock Mode: RESEND_API_KEY not set)',
      });
    }

    // Call Resend REST API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `Kloqo Landing <${fromEmail}>`,
        to: 'info@zynthexion.com',
        subject: 'New Kloqo MVP Interest Registration',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #10b981;">New MVP Signup Interest</h2>
            <p>A user has registered their interest on the Kloqo Landing Page.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px;">Email Address:</td>
                <td style="padding: 8px 0; color: #000; font-size: 16px;"><strong>${email}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Signup Time:</td>
                <td style="padding: 8px 0; color: #666;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">This is an automated notification from your Kloqo App Engine deployment.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Resend API call failed:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to send registration notification.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      message: 'Successfully registered interest! We will contact you soon.',
      id: data.id,
    });
  } catch (error: any) {
    console.error('❌ Subscription handler error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

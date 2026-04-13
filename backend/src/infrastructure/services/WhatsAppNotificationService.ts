import axios from 'axios';

export interface IWhatsAppNotificationService {
  sendTemplate(params: {
    to: string;
    templateName: string;
    templateVariables?: Record<string, string>;
    mediaUrl?: string;
    buttonPayloads?: { index: number; payload: string }[];
  }): Promise<boolean>;
  sendMessage(to: string, text: string): Promise<boolean>;
}

export class WhatsAppNotificationService implements IWhatsAppNotificationService {
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  async sendTemplate(params: {
    to: string;
    templateName: string;
    templateVariables?: Record<string, string>;
    mediaUrl?: string; // For Document Header
    buttonPayloads?: { index: number; payload: string }[];
  }): Promise<boolean> {
    try {
      const { to, templateName, templateVariables, mediaUrl, buttonPayloads } = params;

      const components: any[] = [];

      // Add Document Header if mediaUrl is provided
      if (mediaUrl) {
        components.push({
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: { link: mediaUrl }
            }
          ]
        });
      }

      // Add Body Variables
      if (templateVariables && Object.keys(templateVariables).length > 0) {
        const bodyParameters = Object.keys(templateVariables).map(key => ({
          type: 'text',
          text: templateVariables[key]
        }));
        
        components.push({
          type: 'body',
          parameters: bodyParameters
        });
      }

      // Add Interactive Button Payloads
      if (buttonPayloads && buttonPayloads.length > 0) {
        buttonPayloads.forEach(btn => {
          components.push({
            type: 'button',
            sub_type: 'quick_reply',
            index: btn.index.toString(),
            parameters: [
              {
                type: 'payload',
                payload: btn.payload
              }
            ]
          });
        });
      }

      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: components.length > 0 ? components : undefined
        }
      };

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return true;
    } catch (error) {
      console.error('[WhatsApp Service] Template delivery failed:', error);
      return false;
    }
  }

  // Fallback for simple text messages (optional, based on your previous interface)
  async sendMessage(to: string, text: string): Promise<boolean> {
      try {
          const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
          await axios.post(url, {
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { body: text }
          }, {
              headers: {
                  'Authorization': `Bearer ${this.accessToken}`,
                  'Content-Type': 'application/json'
              }
          });
          return true;
      } catch (error) {
          console.error('[WhatsApp Service] Text delivery failed:', error);
          return false;
      }
  }
}

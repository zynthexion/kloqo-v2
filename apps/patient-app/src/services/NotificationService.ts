/**
 * NotificationService.ts
 * 
 * Handles the "Progressive Alerts" for the Patient App.
 * Uses the browser's Notification API and the Vibrate API to replace 
 * legacy audio announcements.
 */

export class NotificationService {
  /**
   * Triggers the "Almost There" alert.
   * Condition: User is next in line (Tokens Ahead === 1).
   */
  static async notifyAlmostThere(tokenNumber: string) {
    const title = "നിങ്ങളുടെ ഊഴം അടുത്തെത്തി! (Almost There)";
    const body = `ടോക്കൺ ${tokenNumber}, ദയവായി ഡോക്ടറുടെ മുറിയുടെ അടുത്തേക്ക് വരൂ.`;
    
    this.vibrate([300, 100, 300]); // Premium double pulse
    this.sendBrowserNotification(title, body, false, 'almost-there');
  }

  /**
   * Triggers the "Your Turn" alert.
   * Condition: Active Token matches User Token.
   */
  static async notifyYourTurn(tokenNumber: string) {
    const title = "നിങ്ങളുടെ ഊഴമായി! (Your Turn)";
    const body = `ടോക്കൺ ${tokenNumber}, ദയവായി ഇപ്പോൾ ഡോക്ടറുടെ മുറിയിലേക്ക് പ്രവേശിക്കുക.`;
    
    // Deep, persistent Zomato-style vibration
    this.vibrate([500, 200, 500, 200, 800, 200, 800]); 
    this.sendBrowserNotification(title, body, true, 'your-turn');
  }

  private static vibrate(pattern: number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  private static async sendBrowserNotification(title: string, body: string, requireInteraction = false, tag?: string) {
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'granted') {
      try {
        // Use ServiceWorker registration if available for better background support
        const registration = await navigator.serviceWorker?.ready;
        if (registration && registration.showNotification) {
          const options: any = {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
            tag: tag || 'kloqo-alert',
            renotify: true,
            requireInteraction,
            data: { url: window.location.href }
          };
          registration.showNotification(title, options);
        } else {
          new Notification(title, { 
            body, 
            icon: '/icons/icon-192x192.png',
            requireInteraction,
            tag: tag || 'kloqo-alert',
            silent: false
          });
        }
      } catch (err) {
        console.warn('Browser notification failed:', err);
      }
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.sendBrowserNotification(title, body, requireInteraction, tag);
      }
    }
  }
}

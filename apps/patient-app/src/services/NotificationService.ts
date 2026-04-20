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
    const title = "You are next!";
    const body = `Please wait near the Doctor's cabin. Your token ${tokenNumber} is up next.`;
    
    this.vibrate([200, 100, 200]); // Short double pulse
    this.sendBrowserNotification(title, body);
  }

  /**
   * Triggers the "Your Turn" alert.
   * Condition: Active Token matches User Token.
   */
  static async notifyYourTurn(tokenNumber: string) {
    const title = "It is your turn!";
    const body = `Token ${tokenNumber}, please enter the Doctor's cabin now.`;
    
    // Heavy, persistent vibration pattern
    this.vibrate([500, 200, 500, 200, 500]); 
    this.sendBrowserNotification(title, body, true);
  }

  private static vibrate(pattern: number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  private static async sendBrowserNotification(title: string, body: string, requireInteraction = false) {
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'granted') {
      new Notification(title, { 
        body, 
        icon: '/favicon.ico', // Update with actual icon path if available
        requireInteraction,
        silent: false
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.sendBrowserNotification(title, body, requireInteraction);
      }
    }
  }
}

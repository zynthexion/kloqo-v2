import { PrescriptionPage } from '@kloqo/shared';
import { getClinicNow } from './date-utils';

const DRAFT_PREFIX = 'rx_draft_';

interface DraftContainer {
  pages: PrescriptionPage[];
  timestamp: number;
}

/**
 * Service to manage local persistence of prescription drafts.
 * Prevents data loss when switching between patients or during page reloads.
 */
export const PrescriptionDraftService = {
  /**
   * Saves a prescription draft for a specific appointment.
   */
  save(appointmentId: string, pages: PrescriptionPage[]): void {
    if (typeof window === 'undefined') return;
    try {
      const container: DraftContainer = {
        pages,
        timestamp: getClinicNow().getTime()
      };
      localStorage.setItem(`${DRAFT_PREFIX}${appointmentId}`, JSON.stringify(container));
      console.log(`[PrescriptionDraftService] Draft saved for ${appointmentId} (${pages.length} pages)`);
    } catch (error) {
      console.error('Failed to save prescription draft:', error);
      // If we hit quota, try to cleanup immediately
      this.cleanup(0); 
    }
  },

  /**
   * Retrieves a draft for a specific appointment.
   */
  get(appointmentId: string): { pages: PrescriptionPage[]; timestamp: number } | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`${DRAFT_PREFIX}${appointmentId}`);
      if (!data) return null;
      console.log(`[PrescriptionDraftService] Draft found for ${appointmentId}`);
      return JSON.parse(data) as DraftContainer;
    } catch (error) {
      console.error('Failed to retrieve prescription draft:', error);
      return null;
    }
  },

  /**
   * Clears a draft for a specific appointment.
   */
  clear(appointmentId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${DRAFT_PREFIX}${appointmentId}`);
    console.log(`[PrescriptionDraftService] Draft cleared for ${appointmentId}`);
  },

  /**
   * Cleans up old drafts to prevent LocalStorage bloat.
   * Runs through all keys and removes those older than maxAgeHours.
   */
  cleanup(maxAgeHours: number = 12): void {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const container = JSON.parse(data) as DraftContainer;
            if (now - container.timestamp > maxAgeMs) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // If we can't parse it, it's likely corrupt or old format
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[PrescriptionDraftService] Cleaned up ${keysToRemove.length} stale drafts.`);
    }
  }
};

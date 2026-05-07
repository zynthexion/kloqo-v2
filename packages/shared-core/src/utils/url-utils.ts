/**
 * URL Utilities for Kloqo V2
 * Centralizes logic for handling asset URLs, proxies, and storage paths.
 */

export const URLUtils = {
  /**
   * Determines if a URL needs to be proxied to bypass CORS/Tainted Canvas issues.
   * Currently triggers for Firebase Storage URLs.
   */
  shouldProxy(url: string): boolean {
    return url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com');
  },

  /**
   * Constructs a proxied URL for a given source.
   * @param sourceUrl The original URL
   * @param apiBase The base API URL (e.g., process.env.NEXT_PUBLIC_API_URL)
   */
  getProxiedUrl(sourceUrl: string, apiBase: string): string {
    if (!this.shouldProxy(sourceUrl)) return sourceUrl;
    
    // Ensure we don't have double slashes
    const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${base}/utils/proxy-image?url=${encodeURIComponent(sourceUrl)}`;
  }
};

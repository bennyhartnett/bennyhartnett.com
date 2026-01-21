/**
 * Analytics - Google Analytics helpers
 */

/**
 * Track a page view in Google Analytics
 * @param {string} url - The page URL (e.g., 'pages/home.html')
 * @param {string} title - The page title
 * @param {string} fullUrl - The full canonical URL
 */
export function trackPageView(url, title, fullUrl) {
  if (typeof gtag === 'function') {
    gtag('event', 'page_view', {
      page_path: '/' + url.replace('.html', ''),
      page_title: title,
      page_location: fullUrl
    });
  }
}

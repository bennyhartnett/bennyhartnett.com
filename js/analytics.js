/**
 * Analytics Module
 * Handles Google Analytics tracking helpers
 */

/**
 * Track a page view in Google Analytics
 * @param {string} url - Page URL path
 * @param {string} title - Page title
 * @param {string} fullUrl - Full page URL
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

/**
 * Track a custom event in Google Analytics
 * @param {string} eventName - Name of the event
 * @param {Object} params - Event parameters
 */
export function trackEvent(eventName, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
}

/**
 * Track an outbound link click
 * @param {string} url - External URL being clicked
 * @param {string} linkText - Text of the link
 */
export function trackOutboundLink(url, linkText = '') {
  trackEvent('click', {
    event_category: 'outbound',
    event_label: linkText || url,
    transport_type: 'beacon',
    link_url: url
  });
}

/**
 * Track a file download
 * @param {string} filename - Name of the downloaded file
 * @param {string} fileType - Type of file (e.g., 'pdf', 'doc')
 */
export function trackDownload(filename, fileType = '') {
  trackEvent('file_download', {
    file_name: filename,
    file_extension: fileType || filename.split('.').pop()
  });
}

/**
 * Track a form submission
 * @param {string} formName - Name/identifier of the form
 * @param {boolean} success - Whether submission was successful
 */
export function trackFormSubmission(formName, success = true) {
  trackEvent('form_submit', {
    form_name: formName,
    form_success: success
  });
}

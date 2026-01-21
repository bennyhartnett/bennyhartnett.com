/**
 * Utilities - Common helper functions
 */

/**
 * Email obfuscation utility - prevents scraping while allowing JS access
 * @returns {string} The protected email address
 */
export function getProtectedEmail() {
  const p = ['m', 'e', '@', 'b', 'e', 'n', 'n', 'y', 'h', 'a', 'r', 't', 'n', 'e', 't', 't', '.', 'c', 'o', 'm'];
  return p.join('');
}

// Also expose on window for inline scripts in page fragments
window.getProtectedEmail = getProtectedEmail;

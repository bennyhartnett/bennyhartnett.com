/**
 * SPA Router Module
 * Handles page loading, routing, transitions, and navigation
 */

import { updateMetaTags, getMetaMap, getBaseOgImage } from './meta-manager.js';
import { trackPageView } from './analytics.js';

// Container element for content
let container = null;

/**
 * Animate content entry after page load
 */
function animateContentEntry() {
  container.classList.remove('page-exit');
  container.classList.add('page-enter');
  // Trigger reflow to ensure transition starts from enter state
  container.offsetHeight;
  container.classList.add('page-enter-active');
  container.classList.remove('page-enter');
  // Cleanup classes after animation
  setTimeout(() => {
    container.classList.remove('page-enter-active');
  }, 300);
}

/**
 * Load content from a URL into the main container
 * @param {string} url - The URL of the page to load
 * @param {boolean} push - Whether to push to browser history
 * @param {boolean} skipExitAnimation - Skip exit animation (for initial load)
 */
export function loadContent(url, push = true, skipExitAnimation = false) {
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');
  const metaMap = getMetaMap();
  const baseOgImage = getBaseOgImage();

  // Start exit animation (skip on initial page load)
  if (!skipExitAnimation) {
    container.classList.add('page-exit');
  }

  // Wait for exit animation (or proceed immediately if skipped), then fetch and load new content
  setTimeout(() => {
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Page not found');
        return r.text();
      })
      .then(html => {
        container.innerHTML = html;
        animateContentEntry();
        // Execute any inline scripts from the loaded fragment
        container.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script');
          if (oldScript.type) newScript.type = oldScript.type;
          if (oldScript.src) {
            newScript.src = oldScript.src;
          } else {
            newScript.textContent = oldScript.textContent;
          }
          oldScript.replaceWith(newScript);
        });

        const meta = metaMap[url] || metaMap['pages/home.html'];
        const fullUrl = (url === 'pages/home.html') ? baseUrl : baseUrl + url.replace('pages/', '').replace('.html', '');

        // Update all meta tags
        updateMetaTags(meta, fullUrl, baseOgImage);

        // Track page view
        trackPageView(url, meta.title, fullUrl);

        if (push) {
          const cleanUrl = url === 'pages/home.html' ? '/' : '/' + url.replace('pages/', '').replace('.html', '');
          history.pushState({ url }, '', cleanUrl);
        }
      })
      .catch(() => {
        renderFallbackContent(url);
        animateContentEntry();
      });
  }, skipExitAnimation ? 0 : 300);
}

/**
 * Render fallback content when page fetch fails
 * @param {string} url - The URL that failed to load
 */
function renderFallbackContent(url) {
  if (url === 'pages/home.html') {
    container.innerHTML = `\
      <style>\
        .home-container { min-height: calc(100vh - 56px - 2rem); display: flex; justify-content: center; align-items: center; padding: 1rem; }\
        .link-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; }\
        .link-list li { margin: 0; }\
        .link-list a { display: block; color: white; text-decoration: none; font-size: 1.5rem; font-family: 'Inter', sans-serif; padding: 0.75rem; transition: color 0.3s ease; cursor: pointer; }\
        .link-list a:hover { color: var(--wave-color); }\
        @keyframes colorCycle { 0% { color: #6366f1; } 20% { color: #8b5cf6; } 40% { color: #ec4899; } 60% { color: #f59e0b; } 80% { color: #10b981; } 100% { color: #6366f1; } }\
        .chat-fab { position: fixed; bottom: 2rem; right: 2rem; height: 48px; padding: 0 1.25rem; border-radius: 24px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none; z-index: 99; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1); animation: colorCycle 8s ease-in-out infinite; transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease; }\
        .chat-fab svg { width: 22px; height: 22px; flex-shrink: 0; }\
        .chat-fab-text { font-size: 0.9rem; font-weight: 600; white-space: nowrap; letter-spacing: 0.02em; }\
        .chat-fab:hover { transform: scale(1.05); background: rgba(255, 255, 255, 0.15); }\
      </style>\
      <div class="home-container">\
      <ul class="link-list">\
        <li><a data-href="https://www.linkedin.com/in/dev-dc" data-external="true">LinkedIn</a></li>\
        <li><a data-href="https://github.com/bennyhartnett" data-external="true">GitHub</a></li>\
        <li><a data-action="download-resume">Resume</a></li>\
        <li><a data-href="/nuclear">Nuclear</a></li>\
        <li><a data-href="/contact">Contact</a></li>\
      </ul>\
      </div>\
      <a href="/chat" class="chat-fab" aria-label="Chat with Benny AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span class="chat-fab-text">Ask AI Benny</span></a>`;
  } else if (url === 'pages/privacy.html') {
    container.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
        body { font-family: 'Inter', sans-serif; color: white; padding: 1rem; }
        a { color: white; text-decoration: none; transition: color 0.3s ease; }
        a:hover { color: var(--wave-color); }
      </style>
      <h1>Privacy Policy</h1>
      <p>Last updated: ${new Date().getFullYear()}</p>
      <p>We may collect personal or non-personal data for any purpose.</p>
      <p>Contact <a href="#" class="copy-email" data-email="">email</a> for questions.</p><script>document.querySelector('.copy-email').dataset.email=window.getProtectedEmail();document.querySelector('.copy-email').textContent=window.getProtectedEmail();<\/script>`;
  } else {
    container.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
        body { font-family: 'Inter', sans-serif; color: white; margin: 0; }
        .error-container {
          min-height: calc(100vh - 56px - 2rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 1rem;
          text-align: center;
        }
        .error-code {
          font-size: 6rem;
          font-weight: 600;
          margin: 0;
          opacity: 0.3;
        }
        .error-message {
          font-size: 1.5rem;
          margin: 0.5rem 0 1.5rem 0;
        }
        .error-link {
          color: white;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        .error-link:hover {
          background: var(--wave-color);
          border-color: var(--wave-color);
        }
      </style>
      <div class="error-container">
        <p class="error-code">404</p>
        <p class="error-message">Page not found</p>
        <a href="/" class="error-link">Go Home</a>
      </div>`;
  }
}

/**
 * Handle link clicks for SPA navigation
 * @param {Event} e - Click event
 */
function handleLinkClick(e) {
  // Handle email copy
  const emailLink = e.target.closest('.copy-email');
  if (emailLink) {
    e.preventDefault();
    const email = emailLink.dataset.email;
    navigator.clipboard.writeText(email).then(() => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          text: 'Email copied to clipboard',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          background: '#333',
          color: '#fff'
        });
      }
    });
    return;
  }

  // Secure resume download
  const resumeLink = e.target.closest('[data-action="download-resume"]');
  if (resumeLink) {
    e.preventDefault();
    const p = ['/', 'assets', '/d/', 'r-', '8f3a', '2c9e', '7b1d', '.pdf'];
    const url = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7];
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume_benny_hartnett.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const link = e.target.closest('a');
  if (!link) return;

  // Support data-href to prevent URL preview on hover
  const href = link.getAttribute('data-href') || link.getAttribute('href');
  if (!href) return;

  // Handle external links
  if (link.dataset.external === 'true') {
    e.preventDefault();
    window.open(href, '_blank', 'noopener');
    return;
  }

  // Skip SPA handling for nuclear page - do full page navigation
  if (href === 'nuclear.html' || href === '/nuclear.html' || href === '/nuclear') {
    e.preventDefault();
    window.location.href = 'https://nuclear.bennyhartnett.com';
    return;
  }

  // Handle home link - redirect to main domain
  if (href === '/' || href === '/home' || href === 'home.html' || href === '/home.html') {
    e.preventDefault();
    window.location.href = 'https://bennyhartnett.com';
    return;
  }

  // Handle clean URLs and .html URLs
  const excludedPrefixes = ['/assets', '/images', '/css', '/js', '/pages', '/.well-known'];
  const isExcludedPath = excludedPrefixes.some(prefix => href.startsWith(prefix));
  const isCleanUrl = href && href.startsWith('/') && !href.startsWith('http') && href !== '/' && !isExcludedPath;
  const isHtmlUrl = href && href.endsWith('.html') && !href.startsWith('http') && !isExcludedPath;

  if (isCleanUrl || isHtmlUrl) {
    e.preventDefault();
    let pageName;
    if (isCleanUrl) {
      pageName = href.substring(1);
    } else {
      pageName = href.replace(/^pages\//, '').replace(/\.html$/, '');
    }
    // Redirect to subdomain
    const targetUrl = 'https://' + pageName + '.bennyhartnett.com';
    window.location.href = targetUrl;
  }
}

/**
 * Handle browser back/forward navigation
 * @param {PopStateEvent} e - PopState event
 */
function handlePopState(e) {
  const state = e.state;
  if (state && state.url) {
    loadContent(state.url, false);
  }
}

/**
 * Determine the initial page to load
 * @returns {string} Initial page URL
 */
function getInitialPage() {
  let initial = 'pages/home.html';
  const hostname = location.hostname;
  const rootDomain = 'bennyhartnett.com';
  const isSubdomain = hostname.endsWith('.' + rootDomain) && hostname !== 'www.' + rootDomain;

  if (isSubdomain) {
    const subdomain = hostname.replace('.' + rootDomain, '');
    initial = subdomain === 'nuclear' ? 'nuclear.html' : 'pages/' + subdomain + '.html';
  } else {
    // Check for SPA redirect from 404.html
    const redirectPath = sessionStorage.getItem('spa-redirect');
    if (redirectPath) {
      sessionStorage.removeItem('spa-redirect');
      let pageName = redirectPath.endsWith('.html') ? redirectPath : redirectPath + '.html';
      initial = pageName === 'nuclear.html' ? pageName : 'pages/' + pageName.replace(/^pages\//, '');
    } else {
      const path = location.pathname.replace(/^\//, '').replace(/\/$/, '');
      if (path && path !== 'index.html' && path !== '') {
        let pageName = path.endsWith('.html') ? path : path + '.html';
        initial = pageName === 'nuclear.html' ? pageName : 'pages/' + pageName.replace(/^pages\//, '');
      } else if (location.hash) {
        let pageName = location.hash.substring(1);
        initial = pageName === 'nuclear.html' ? pageName : 'pages/' + pageName.replace(/^pages\//, '');
      }
    }
  }

  return initial;
}

/**
 * Check if current hostname is a subdomain
 * @returns {boolean}
 */
function isSubdomain() {
  const hostname = location.hostname;
  const rootDomain = 'bennyhartnett.com';
  return hostname.endsWith('.' + rootDomain) && hostname !== 'www.' + rootDomain;
}

/**
 * Initialize the SPA router
 */
export function initRouter() {
  container = document.querySelector('#main-content');
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');

  // Update canonical and og:url
  const canonicalTag = document.getElementById('canonical-link');
  const ogUrlTag = document.getElementById('og-url');
  if (canonicalTag) canonicalTag.setAttribute('href', baseUrl);
  if (ogUrlTag) ogUrlTag.setAttribute('content', baseUrl);

  // Setup title click handler
  const title = document.querySelector('nav .title');
  if (title) {
    title.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'https://bennyhartnett.com';
    });
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = 'https://bennyhartnett.com';
      }
    });
  }

  // Attach event listeners
  document.body.addEventListener('click', handleLinkClick);
  window.addEventListener('popstate', handlePopState);

  // Load initial page
  const initial = getInitialPage();
  const cleanUrl = isSubdomain() ? '/' : (initial === 'pages/home.html' ? '/' : '/' + initial.replace('pages/', '').replace('.html', ''));
  history.replaceState({ url: initial }, '', cleanUrl);
  loadContent(initial, false, true);
}

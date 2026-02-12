/**
 * Meta Manager Module
 * Handles dynamic meta tag updates for SEO and social sharing
 */

const BASE_OG_IMAGE = 'https://bennyhartnett.com/assets/og-image.png';

/**
 * Page metadata configuration
 */
const META_MAP = {
  'pages/home.html': {
    title: 'Benny Hartnett - Home',
    desc: 'Overview of Benny Hartnett\'s projects including generative AI, nuclear work and contracting.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Benny Hartnett - Software Developer specializing in AI, IoT, and Nuclear Technology'
  },
  'nuclear.html': {
    title: 'Nuclear Research - Benny Hartnett',
    desc: 'Summaries of Benny Hartnett\'s nuclear-related projects.',
    ogImage: 'https://bennyhartnett.com/assets/og-nuclear.png',
    ogImageAlt: 'Nuclear Technology - Uranium Enrichment Calculator'
  },
  'pages/privacy.html': {
    title: 'Privacy Policy - Benny Hartnett',
    desc: 'Privacy practices for this site.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Benny Hartnett - Privacy Policy'
  },
  '404.html': {
    title: 'Page Not Found - Benny Hartnett',
    desc: 'The requested page could not be found.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Benny Hartnett - Page Not Found'
  },
  'pages/contact.html': {
    title: 'Contact - Benny Hartnett',
    desc: 'Get in touch with Benny Hartnett.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Contact Benny Hartnett'
  },
  'pages/thank-you.html': {
    title: 'Thank You - Benny Hartnett',
    desc: 'Thank you for your message.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Thank You - Benny Hartnett'
  },
  'pages/projects.html': {
    title: 'Projects - Benny Hartnett',
    desc: 'Portfolio of projects spanning generative AI, government contracting, and nuclear research.',
    ogImage: 'https://bennyhartnett.com/assets/og-projects.png',
    ogImageAlt: 'Projects Portfolio - AI, IoT, Government Tech, and Nuclear'
  },
  'pages/chat.html': {
    title: 'Chat - Benny Hartnett',
    desc: 'AI-powered chat to learn more about Benny Hartnett.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Chat with AI about Benny Hartnett'
  },
  'pages/app.html': {
    title: 'Install App - Benny Hartnett',
    desc: 'Install the SWU Calculator app for uranium enrichment calculations on iPhone and iPad.',
    ogImage: 'https://bennyhartnett.com/assets/og-nuclear.png',
    ogImageAlt: 'SWU Calculator - Uranium Enrichment App for iOS'
  },
  'pages/meet.html': {
    title: 'Meet - Benny Hartnett',
    desc: 'Video conferencing with screen sharing and real-time collaboration. No sign-up required.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Meet - Video Conferencing Tool'
  },
  'pages/clipboard.html': {
    title: 'Clipboard - Benny Hartnett',
    desc: 'Instant peer-to-peer sharing of text, images, and files using WebRTC. No server storage.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Clipboard - Peer-to-Peer File Sharing'
  },
  'pages/tools.html': {
    title: 'Tools - Benny Hartnett',
    desc: 'Apps and utilities including video conferencing, clipboard sharing, and calculators.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Tools - Apps and Utilities by Benny Hartnett'
  },
  'pages/resume.html': {
    title: 'Resume - Benny Hartnett',
    desc: 'Professional resume and background in software development, AI, and nuclear technology.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Resume - Benny Hartnett Professional Background'
  },
  'pages/terms.html': {
    title: 'Terms - Benny Hartnett',
    desc: 'Terms and privacy practices for bennyhartnett.com.',
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Terms and Privacy - Benny Hartnett'
  }
};

/**
 * Get the meta map configuration
 * @returns {Object} Meta map object
 */
export function getMetaMap() {
  return META_MAP;
}

/**
 * Get the base OG image URL
 * @returns {string} Base OG image URL
 */
export function getBaseOgImage() {
  return BASE_OG_IMAGE;
}

// Cache DOM references to avoid repeated querySelector calls on every page change
let cachedElements = null;

function getMetaElements() {
  if (cachedElements) return cachedElements;
  cachedElements = {
    desc: document.querySelector('meta[name="description"]'),
    canonical: document.querySelector('link[rel="canonical"]'),
    ogTitle: document.querySelector('meta[property="og:title"]'),
    ogDesc: document.querySelector('meta[property="og:description"]'),
    ogUrl: document.querySelector('meta[property="og:url"]'),
    ogImage: document.getElementById('og-image'),
    ogImageAlt: document.getElementById('og-image-alt'),
    twitterTitle: document.querySelector('meta[name="twitter:title"]'),
    twitterDesc: document.querySelector('meta[name="twitter:description"]'),
    twitterImage: document.getElementById('twitter-image'),
    twitterImageAlt: document.getElementById('twitter-image-alt'),
  };
  return cachedElements;
}

/**
 * Update all meta tags for a page
 * @param {Object} meta - Meta configuration object
 * @param {string} fullUrl - Full URL of the page
 * @param {string} baseOgImage - Base OG image URL for fallback
 */
export function updateMetaTags(meta, fullUrl, baseOgImage = BASE_OG_IMAGE) {
  const el = getMetaElements();

  document.title = meta.title;

  if (el.desc) el.desc.setAttribute('content', meta.desc);
  if (el.canonical) el.canonical.setAttribute('href', fullUrl);
  if (el.ogTitle) el.ogTitle.setAttribute('content', meta.title);
  if (el.ogDesc) el.ogDesc.setAttribute('content', meta.desc);
  if (el.ogUrl) el.ogUrl.setAttribute('content', fullUrl);
  if (el.ogImage) el.ogImage.setAttribute('content', meta.ogImage || baseOgImage);
  if (el.ogImageAlt) el.ogImageAlt.setAttribute('content', meta.ogImageAlt || 'Benny Hartnett');
  if (el.twitterTitle) el.twitterTitle.setAttribute('content', meta.title);
  if (el.twitterDesc) el.twitterDesc.setAttribute('content', meta.desc);
  if (el.twitterImage) el.twitterImage.setAttribute('content', meta.ogImage || baseOgImage);
  if (el.twitterImageAlt) el.twitterImageAlt.setAttribute('content', meta.ogImageAlt || 'Benny Hartnett');
}

/**
 * Initialize canonical and OG URLs on page load
 */
export function initMetaTags() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');
  const canonicalTag = document.getElementById('canonical-link');
  const ogUrlTag = document.getElementById('og-url');

  if (canonicalTag) canonicalTag.setAttribute('href', baseUrl);
  if (ogUrlTag) ogUrlTag.setAttribute('content', baseUrl);
}

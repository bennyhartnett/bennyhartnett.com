/**
 * Meta Manager - Handles dynamic meta tag updates for SEO and social sharing
 */

const BASE_OG_IMAGE = 'https://bennyhartnett.com/assets/og-image.png';

/**
 * Page-specific meta configurations
 */
export const META_MAP = {
  'pages/home.html': {
    title: 'Benny Hartnett - Home',
    desc: "Overview of Benny Hartnett's projects including generative AI, nuclear work and contracting.",
    ogImage: BASE_OG_IMAGE,
    ogImageAlt: 'Benny Hartnett - Software Developer specializing in AI, IoT, and Nuclear Technology'
  },
  'pages/generative-ai.html': {
    title: 'Generative AI - Benny Hartnett',
    desc: 'Articles and resources on generative AI from Benny Hartnett.',
    ogImage: 'https://bennyhartnett.com/assets/og-generative-ai.png',
    ogImageAlt: 'Generative AI - Large Language Models and AI Development'
  },
  'pages/government-contracting.html': {
    title: 'Government Contracting - Benny Hartnett',
    desc: 'Insights and resources about government contracting.',
    ogImage: 'https://bennyhartnett.com/assets/og-government-contracting.png',
    ogImageAlt: 'Government Contracting - Federal Technology Solutions'
  },
  'nuclear.html': {
    title: 'Nuclear Research - Benny Hartnett',
    desc: "Summaries of Benny Hartnett's nuclear-related projects.",
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
  }
};

/**
 * Update all meta tags for a given page
 * @param {string} url - The page URL (e.g., 'pages/home.html')
 * @param {string} baseUrl - The base URL for canonical links
 */
export function updateMetaTags(url, baseUrl) {
  const meta = META_MAP[url] || META_MAP['pages/home.html'];

  // Update document title
  document.title = meta.title;

  // Update description
  const descTag = document.querySelector('meta[name="description"]');
  if (descTag) descTag.setAttribute('content', meta.desc);

  // Build full URL for canonical and OG
  const fullUrl = (url === 'pages/home.html')
    ? baseUrl
    : baseUrl + url.replace('pages/', '').replace('.html', '');

  // Update canonical link
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', fullUrl);

  // Update Open Graph tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', meta.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', meta.desc);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', fullUrl);

  const ogImage = document.getElementById('og-image');
  if (ogImage) ogImage.setAttribute('content', meta.ogImage || BASE_OG_IMAGE);

  const ogImageAlt = document.getElementById('og-image-alt');
  if (ogImageAlt) ogImageAlt.setAttribute('content', meta.ogImageAlt || 'Benny Hartnett');

  // Update Twitter Card meta tags
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', meta.title);

  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc) twitterDesc.setAttribute('content', meta.desc);

  const twitterImage = document.getElementById('twitter-image');
  if (twitterImage) twitterImage.setAttribute('content', meta.ogImage || BASE_OG_IMAGE);

  const twitterImageAlt = document.getElementById('twitter-image-alt');
  if (twitterImageAlt) twitterImageAlt.setAttribute('content', meta.ogImageAlt || 'Benny Hartnett');

  return { meta, fullUrl };
}

/**
 * Initialize canonical and OG URL tags on page load
 * @param {string} baseUrl - The base URL
 */
export function initializeMetaTags(baseUrl) {
  const canonicalTag = document.getElementById('canonical-link');
  const ogUrlTag = document.getElementById('og-url');

  if (canonicalTag) canonicalTag.setAttribute('href', baseUrl);
  if (ogUrlTag) ogUrlTag.setAttribute('content', baseUrl);
}

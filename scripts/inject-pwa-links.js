/**
 * inject-pwa-links.js
 * -------------------
 * Post-build script that injects PWA meta tags into dist/index.html.
 *
 * Expo's Metro web export adds theme-color and description from app.json but
 * does not auto-generate the <link rel="manifest"> or Apple PWA meta tags.
 * This script adds them so that:
 *   - Chrome / Android recognises the PWA manifest
 *   - Safari shows the correct name + icon when "Add to Home Screen" is used
 *
 * Run automatically via the "build:web" npm script.
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('inject-pwa-links: dist/index.html not found — did the build succeed?');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

const pwaLinks = [
  '  <link rel="manifest" href="/manifest.json" />',
  '  <meta name="apple-mobile-web-app-capable" content="yes" />',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '  <meta name="apple-mobile-web-app-title" content="Tracker" />',
  '  <link rel="apple-touch-icon" href="/assets/icon.png" />',
].join('\n');

// Only inject if not already present (idempotent).
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${pwaLinks}\n</head>`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ PWA links injected into dist/index.html');
} else {
  console.log('ℹ️  PWA links already present — skipping injection.');
}

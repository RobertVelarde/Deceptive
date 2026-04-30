import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs   from 'fs';

// Use local HTTPS certs when present (dev only — never in CI / production builds).
const CERT_KEY  = '.cert/key.pem';
const CERT_CERT = '.cert/cert.pem';
const httpsConfig = fs.existsSync(CERT_KEY)
  ? { key: fs.readFileSync(CERT_KEY), cert: fs.readFileSync(CERT_CERT) }
  : false;

export default defineConfig({
  plugins: [react()],

  // Root-relative base — required for a custom domain on GitHub Pages.
  // (A repo-path subdirectory base such as '/Deceptive/' is NOT needed when
  //  the site is served from the domain apex via a CNAME record.)
  base: '/',

  server: {
    host:  '0.0.0.0',   // listen on all interfaces (LAN + Tailscale)
    port:  5173,
    https: httpsConfig,
  },

  test: {
    // Run tests in a plain Node environment — no browser APIs needed for
    // engine / game-logic tests. Components that require a DOM get their
    // own environment override at the file level via @vitest-environment jsdom.
    environment: 'node',
    include:     ['src/**/*.test.{js,jsx}'],
  },
});

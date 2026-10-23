// The page's Content Security Policy. The same text is in public/_headers (Cloudflare) and vercel.json; csp.test.ts
// keeps them in sync.
//
// - Scripts only from this origin: no inline scripts, no third-party scripts. 'wasm-unsafe-eval' is for the code
//   highlighter's WebAssembly engine (Shiki), as in the desktop app.
// - connect-src 'self' wss: the relay is any wss:// address the paired computer names (official or self-hosted).
// - style-src allows inline styles: the renderer's animation libraries insert <style> elements, and a static host
//   cannot hand out a per-response nonce. Scripts stay strict.
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' wss:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** The dev server: Vite's inline React refresh preamble, HMR and a relay on ws://localhost. */
export const DEVELOPMENT_CSP = PRODUCTION_CSP.replace(
  "script-src 'self' 'wasm-unsafe-eval'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
).replace("connect-src 'self' wss:", "connect-src 'self' ws: wss:");

/** `vite preview`: the production policy, with a relay on ws://localhost allowed. */
export const PREVIEW_CSP = PRODUCTION_CSP.replace(
  "connect-src 'self' wss:",
  "connect-src 'self' ws: wss:",
);

/** Every response's security headers except the CSP. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), geolocation=(), microphone=(self), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

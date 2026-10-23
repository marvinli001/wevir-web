import { describe, expect, it } from 'vitest';
import headersFile from '../public/_headers?raw';
import vercel from '../vercel.json';
import { DEVELOPMENT_CSP, PRODUCTION_CSP, SECURITY_HEADERS } from './csp';

describe('hosting headers', () => {
  const expected = { 'Content-Security-Policy': PRODUCTION_CSP, ...SECURITY_HEADERS };

  it('public/_headers (Cloudflare) sends the same headers on every path', () => {
    const block = headersFile.split(/\n(?=\S)/).find((section) => section.startsWith('/*\n'));
    const sent = Object.fromEntries(
      (block ?? '')
        .split('\n')
        .slice(1)
        .filter((line) => line.trim() !== '')
        .map((line) => {
          const index = line.indexOf(':');
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        }),
    );
    expect(sent).toEqual(expected);
  });

  it('vercel.json sends the same headers on every path', () => {
    const all = vercel.headers.find((rule) => rule.source === '/(.*)');
    expect(Object.fromEntries((all?.headers ?? []).map(({ key, value }) => [key, value]))).toEqual(
      expected,
    );
  });

  it('the policy has no third-party sources and no inline scripts', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'self'");
    expect(PRODUCTION_CSP).toContain("connect-src 'self' wss:");
    expect(PRODUCTION_CSP).toContain("frame-ancestors 'none'");
    expect(PRODUCTION_CSP).not.toMatch(/https?:/);
    expect(PRODUCTION_CSP.split('; ').find((d) => d.startsWith('script-src'))).toBe(
      "script-src 'self' 'wasm-unsafe-eval'",
    );
    expect(DEVELOPMENT_CSP).toContain('ws:');
  });
});

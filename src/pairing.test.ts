import { formatPairingUri, PAIRING_URI_PREFIX } from '@wevir/protocol';
import { describe, expect, it } from 'vitest';
import { defaultDeviceName } from './device-name';
import { parsePairingFragment } from './pairing';
import { currentPage } from './paths';

const KEY = 'A'.repeat(43);
const ROUTE = 'B'.repeat(43);
const SECRET = 'C'.repeat(43);

function fragment(relayUrl?: string): string {
  return formatPairingUri({
    hostPublicKey: KEY,
    routeId: ROUTE,
    secret: SECRET,
    hostName: 'Studio',
    candidates: [{ host: '192.168.1.5', port: 47830 }],
    ...(relayUrl !== undefined && { relayUrl }),
  }).slice(PAIRING_URI_PREFIX.length);
}

describe('parsePairingFragment', () => {
  it('reads the parameters of wevir://pair? from the fragment', () => {
    const link = parsePairingFragment(`#${fragment('wss://relay.example.com')}`);
    expect(link).toMatchObject({
      kind: 'ok',
      payload: {
        hostPublicKey: KEY,
        routeId: ROUTE,
        hostName: 'Studio',
        relayUrl: 'wss://relay.example.com',
      },
    });
  });

  it('needs a relay: a browser cannot reach the computer directly', () => {
    expect(parsePairingFragment(fragment())).toEqual({ kind: 'no_relay' });
  });

  it('rejects anything else', () => {
    expect(parsePairingFragment('')).toEqual({ kind: 'invalid' });
    expect(parsePairingFragment(fragment('wss://r.example').replace('v=1', 'v=9'))).toEqual({
      kind: 'invalid',
    });
  });
});

describe('defaultDeviceName', () => {
  it('names the browser and the system', () => {
    expect(
      defaultDeviceName(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome · macOS');
    expect(
      defaultDeviceName(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toBe('Edge · Windows');
    expect(
      defaultDeviceName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
    expect(defaultDeviceName('')).toBe('Browser');
  });
});

describe('currentPage', () => {
  it('maps the shell pages and leaves everything else to the app', () => {
    expect(currentPage('/pair')).toBe('pair');
    expect(currentPage('/pair/')).toBe('pair');
    expect(currentPage('/computers')).toBe('computers');
    expect(currentPage('/')).toBe('app');
    expect(currentPage('/anything')).toBe('app');
  });
});

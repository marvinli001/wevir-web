import { RemoteHandshakeError, RemoteUnreachableError } from '@wevir/client-sdk';
import { CloseCode } from '@wevir/protocol';
import { describe, expect, it } from 'vitest';
import { refusedByComputer } from './removal';

const ROUTE = 'relay.example.com/v1';

describe('refusedByComputer', () => {
  it('a live connection closed with DEVICE_REVOKED', () => {
    expect(refusedByComputer({ code: CloseCode.DEVICE_REVOKED, reason: '' })).toBe(true);
  });

  it('a refused handshake: removed while offline, or a new computer identity', () => {
    for (const reason of ['rejected', 'host_mismatch'] as const) {
      const cause = new RemoteHandshakeError(reason, ROUTE);
      expect(refusedByComputer({ code: 1006, reason: cause.message, cause })).toBe(true);
    }
  });

  it('not a timeout, an unreachable computer or a plain disconnect', () => {
    const timeout = new RemoteHandshakeError('timeout', ROUTE);
    expect(refusedByComputer({ code: 1006, reason: '', cause: timeout })).toBe(false);
    const unreachable = new RemoteUnreachableError([ROUTE], 'offline');
    expect(refusedByComputer({ code: 1006, reason: '', cause: unreachable })).toBe(false);
    expect(refusedByComputer({ code: 1006, reason: '' })).toBe(false);
    expect(refusedByComputer({ code: CloseCode.REMOTE_DISABLED, reason: '' })).toBe(false);
  });
});

import { RemoteHandshakeError, type TransportCloseInfo } from '@wevir/client-sdk';
import { CloseCode } from '@wevir/protocol';

/**
 * Whether the computer no longer accepts this browser, so that only pairing again helps:
 * - it closed a live connection with `DEVICE_REVOKED`;
 * - or a reconnect's handshake was refused. That happens when the device was removed while this page was closed or
 *   offline, or when the computer has a new identity.
 *
 * Retrying either one, from the client, a Retry button or a reload, only adds failed handshakes, and the computer blocks
 * the source address after a few of them. A handshake that timed out is not a refusal.
 */
export function refusedByComputer(info: TransportCloseInfo): boolean {
  if (info.code === CloseCode.DEVICE_REVOKED) return true;
  return info.cause instanceof RemoteHandshakeError && info.cause.reason !== 'timeout';
}

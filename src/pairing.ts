// Pairing from a link the computer shows: `https://web.wevir.si/pair#v=1&k=…&r=…&s=…&relay=…`. The fragment carries
// the same parameters as `wevir://pair?…` and never reaches the server. A browser can only reach the computer through
// the relay (no LAN discovery, no plain ws:// from an https page, and the computer's direct listener refuses browser
// origins), so a link without `relay` cannot be used here.

import { pairRemoteHost, type RemoteConnectedInfo, relayRoute } from '@wevir/client-sdk';
import {
  type DevicePlatform,
  PAIRING_URI_PREFIX,
  type PairingPayload,
  parsePairingUri,
} from '@wevir/protocol';
import { deviceStaticKey, generateDeviceKey } from './device-key';
import { type ComputerRecord, loadIdentity, putComputer, setCurrentComputerId } from './store';

/** The platform this browser reports when pairing. Computers that offer web pairing links (protocol 0.117.0) know it. */
export const DEVICE_PLATFORM: DevicePlatform = 'web';

export type PairingLink =
  | { kind: 'ok'; payload: PairingPayload & { relayUrl: string } }
  | { kind: 'invalid' }
  | { kind: 'no_relay' };

/** Reads the fragment of a pairing link (without the `#`). */
export function parsePairingFragment(fragment: string): PairingLink {
  const payload = parsePairingUri(`${PAIRING_URI_PREFIX}${fragment.replace(/^#/, '')}`);
  if (payload === null) return { kind: 'invalid' };
  if (payload.relayUrl === undefined) return { kind: 'no_relay' };
  return { kind: 'ok', payload: { ...payload, relayUrl: payload.relayUrl } };
}

export type PairingText =
  | { kind: 'ok'; fragment: string }
  | { kind: 'invalid' }
  | { kind: 'no_relay' };

/**
 * Reads a pasted or scanned pairing link: the computer's web link (`https://…/pair#…`, from any web address) or its
 * `wevir://pair?…` link. Returns the parameters as a fragment for the pairing page.
 */
export function pairingLinkFragment(text: string): PairingText {
  const value = text.trim();
  const payload = parsePairingUri(value);
  if (payload === null) return { kind: 'invalid' };
  if (payload.relayUrl === undefined) return { kind: 'no_relay' };
  return { kind: 'ok', fragment: value.slice(value.search(/[#?]/) + 1) };
}

export interface PairOptions {
  payload: PairingPayload & { relayUrl: string };
  deviceName: string;
  /** The handshake is done; the computer now asks its user to allow this device. */
  onAwaitingApproval?(info: RemoteConnectedInfo): void;
  signal?: AbortSignal;
}

/** Pairs, waits for the computer's approval, stores the computer and makes it the current one. */
export async function pairComputer(options: PairOptions): Promise<ComputerRecord> {
  const { payload } = options;
  const key = await generateDeviceKey();
  const identity = await loadIdentity();
  const result = await pairRemoteHost({
    host: { hostPublicKey: payload.hostPublicKey, routeId: payload.routeId },
    device: deviceStaticKey(key),
    secret: { kind: 'uri', secret: payload.secret },
    routes: [relayRoute(WebSocket, payload.relayUrl, payload.routeId)],
    name: options.deviceName,
    platform: DEVICE_PLATFORM,
    identity: { ...identity, clientKind: 'mobile' },
    fallbackDelayMs: 0,
    ...(options.onAwaitingApproval && { onAwaitingApproval: options.onAwaitingApproval }),
    ...(options.signal && { signal: options.signal }),
  });
  const now = new Date().toISOString();
  const hostName = result.host.hostName ?? payload.hostName;
  const record: ComputerRecord = {
    routeId: payload.routeId,
    hostPublicKey: payload.hostPublicKey,
    ...(hostName !== undefined && { hostName }),
    relayUrl: result.host.relayUrl ?? payload.relayUrl,
    devicePublicKey: key.publicKey,
    devicePrivateKey: key.privateKey,
    pairedAt: now,
    lastConnectedAt: now,
  };
  await putComputer(record);
  await setCurrentComputerId(record.routeId);
  return record;
}

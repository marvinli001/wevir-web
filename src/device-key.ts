// The device's Noise static key for one computer: X25519 in WebCrypto, generated non-extractable. Noise only needs the
// public key and DH with it (`StaticKey` in @wevir/noise), so the private key never exists as bytes in JavaScript.

import type { RemoteDeviceKey } from '@wevir/client-sdk';

export interface DeviceKey {
  privateKey: CryptoKey;
  publicKey: Uint8Array;
}

const X25519 = { name: 'X25519' } as const;

/** Whether this browser's WebCrypto has X25519 (Chrome 133, Firefox 130, Safari 17 and later). */
export async function x25519Supported(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey(X25519, false, ['deriveBits']);
    return true;
  } catch {
    return false;
  }
}

export async function generateDeviceKey(): Promise<DeviceKey> {
  const pair = (await crypto.subtle.generateKey(X25519, false, ['deriveBits'])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicKey };
}

/** The key as the remote tunnel takes it. WebCrypto refuses low-order public keys, which the handshake treats as a bad key. */
export function deviceStaticKey(key: DeviceKey): RemoteDeviceKey {
  return {
    publicKey: key.publicKey,
    dh: async (remotePublicKey) => {
      const remote = await crypto.subtle.importKey(
        'raw',
        remotePublicKey as Uint8Array<ArrayBuffer>,
        X25519,
        false,
        [],
      );
      return new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'X25519', public: remote }, key.privateKey, 256),
      );
    },
  };
}

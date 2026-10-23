// The device's Noise static key for one computer: X25519 in WebCrypto, generated non-extractable. Noise only needs the
// public key and DH with it (`StaticKey` in @wevir/noise), so the private key never exists as bytes in JavaScript.
// Except in WebKit, whose IndexedDB reads a non-extractable X25519 key back as null
// (https://bugs.webkit.org/show_bug.cgi?id=312279): there the key is kept as PKCS #8 bytes instead.

import type { RemoteDeviceKey } from '@wevir/client-sdk';

export interface DeviceKey {
  /** The key, or its PKCS #8 bytes where this browser's IndexedDB cannot keep the key itself. */
  privateKey: CryptoKey | Uint8Array;
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

/** Makes a key in the form `persists` (whether a key survives a round trip through IndexedDB) says can be stored. */
export async function generateDeviceKey(
  persists: (key: CryptoKey) => Promise<boolean>,
): Promise<DeviceKey> {
  const pair = (await crypto.subtle.generateKey(X25519, false, ['deriveBits'])) as CryptoKeyPair;
  if (await persists(pair.privateKey))
    return { privateKey: pair.privateKey, publicKey: await publicKeyBytes(pair) };
  const extractable = (await crypto.subtle.generateKey(X25519, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  return {
    privateKey: new Uint8Array(await crypto.subtle.exportKey('pkcs8', extractable.privateKey)),
    publicKey: await publicKeyBytes(extractable),
  };
}

async function publicKeyBytes(pair: CryptoKeyPair): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
}

/** The key as the remote tunnel takes it. WebCrypto refuses low-order public keys, which the handshake treats as a bad key. */
export function deviceStaticKey(key: DeviceKey): RemoteDeviceKey {
  let privateKey: Promise<CryptoKey> | undefined;
  return {
    publicKey: key.publicKey,
    dh: async (remotePublicKey) => {
      privateKey ??=
        key.privateKey instanceof Uint8Array
          ? crypto.subtle.importKey(
              'pkcs8',
              key.privateKey as Uint8Array<ArrayBuffer>,
              X25519,
              false,
              ['deriveBits'],
            )
          : Promise.resolve(key.privateKey);
      const remote = await crypto.subtle.importKey(
        'raw',
        remotePublicKey as Uint8Array<ArrayBuffer>,
        X25519,
        false,
        [],
      );
      return new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'X25519', public: remote }, await privateKey, 256),
      );
    },
  };
}

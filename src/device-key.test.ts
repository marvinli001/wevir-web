import { describe, expect, it } from 'vitest';
import { deviceStaticKey, generateDeviceKey } from './device-key';

describe('generateDeviceKey', () => {
  it('keeps the key itself where IndexedDB stores it, else its PKCS #8 bytes, and both do DH', async () => {
    const kept = await generateDeviceKey(async () => true);
    const bytes = await generateDeviceKey(async () => false);
    expect(kept.privateKey).toBeInstanceOf(CryptoKey);
    expect((kept.privateKey as CryptoKey).extractable).toBe(false);
    expect(bytes.privateKey).toBeInstanceOf(Uint8Array);

    const a = await deviceStaticKey(kept).dh(bytes.publicKey);
    const b = await deviceStaticKey(bytes).dh(kept.publicKey);
    expect(a).toHaveLength(32);
    expect(b).toEqual(a);
  });
});

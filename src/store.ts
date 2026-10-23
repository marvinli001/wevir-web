// What this browser remembers, in IndexedDB: the computers it is paired with, and the client identity for `host.hello`.
// Each computer has its own device key. The private half is a non-extractable WebCrypto CryptoKey: IndexedDB stores
// it as an opaque handle, and no script, this one included, can read its bytes back out. Where IndexedDB loses such a
// key (WebKit, see device-key.ts) it is stored as PKCS #8 bytes.

export interface ComputerRecord {
  /** The computer's relay route ID (base64url); the record's key. */
  routeId: string;
  /** The computer's Noise static public key (base64url). */
  hostPublicKey: string;
  /** The name the computer reports. */
  hostName?: string;
  /** A name given in this browser; shown instead of `hostName`. */
  label?: string;
  /** The relay the computer uses: from the pairing link, then from each handshake. */
  relayUrl: string;
  /** This browser's device key for that computer. */
  devicePublicKey: Uint8Array;
  /** The key, or its PKCS #8 bytes (`DeviceKey.privateKey`). */
  devicePrivateKey: CryptoKey | Uint8Array;
  pairedAt: string;
  lastConnectedAt?: string;
  /** The computer removed this device (the connection closed with `DEVICE_REVOKED`); pairing again clears it. */
  removedAt?: string;
}

export interface StoredIdentity {
  deviceId: string;
  clientId: string;
}

const DB_NAME = 'wevir-web';
const DB_VERSION = 1;
const COMPUTERS = 'computers';
const META = 'meta';

let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COMPUTERS))
        db.createObjectStore(COMPUTERS, { keyPath: 'routeId' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
  return database;
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

export async function listComputers(): Promise<ComputerRecord[]> {
  const records = await run<ComputerRecord[]>(COMPUTERS, 'readonly', (store) => store.getAll());
  return records.sort((a, b) =>
    (b.lastConnectedAt ?? b.pairedAt).localeCompare(a.lastConnectedAt ?? a.pairedAt),
  );
}

export function getComputer(routeId: string): Promise<ComputerRecord | undefined> {
  return run<ComputerRecord | undefined>(COMPUTERS, 'readonly', (store) => store.get(routeId));
}

export async function putComputer(record: ComputerRecord): Promise<void> {
  await run(COMPUTERS, 'readwrite', (store) => store.put(record));
}

/** Changes a stored record in place; does nothing when it was removed meanwhile. */
export async function updateComputer(
  routeId: string,
  change: (record: ComputerRecord) => ComputerRecord,
): Promise<ComputerRecord | undefined> {
  const current = await getComputer(routeId);
  if (current === undefined) return undefined;
  const next = change(current);
  await putComputer(next);
  return next;
}

export async function deleteComputer(routeId: string): Promise<void> {
  await run(COMPUTERS, 'readwrite', (store) => store.delete(routeId));
  if ((await getCurrentComputerId()) === routeId)
    await run(META, 'readwrite', (store) => store.delete('current'));
}

/** The computer the app connects to; the last one opened. */
export function getCurrentComputerId(): Promise<string | undefined> {
  return run<string | undefined>(META, 'readonly', (store) => store.get('current'));
}

export async function setCurrentComputerId(routeId: string): Promise<void> {
  await run(META, 'readwrite', (store) => store.put(routeId, 'current'));
}

/** Whether `key` comes back from IndexedDB as a key. Writes it under a scratch entry and removes it again. */
export async function keepsCryptoKey(key: CryptoKey): Promise<boolean> {
  try {
    await run(META, 'readwrite', (store) => store.put(key, 'probe'));
    const read = await run<unknown>(META, 'readonly', (store) => store.get('probe'));
    await run(META, 'readwrite', (store) => store.delete('probe'));
    return read instanceof CryptoKey;
  } catch {
    return false;
  }
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** The `host.hello` identity of this browser: made once, then the same for every computer. Not a secret. */
export async function loadIdentity(): Promise<StoredIdentity> {
  const stored = await run<StoredIdentity | undefined>(META, 'readonly', (store) =>
    store.get('identity'),
  );
  if (stored !== undefined) return stored;
  const created: StoredIdentity = {
    deviceId: `web-${randomHex(6)}`,
    clientId: `web-${randomHex(6)}`,
  };
  await run(META, 'readwrite', (store) => store.put(created, 'identity'));
  return created;
}

export function computerName(
  record: Pick<ComputerRecord, 'label' | 'hostName'>,
  fallback: string,
): string {
  return record.label?.trim() || record.hostName?.trim() || fallback;
}

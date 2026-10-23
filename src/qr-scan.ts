// Reading QR codes from the camera. The browser's own Barcode Detection API when it reads QR codes (Chrome on Android
// and macOS); elsewhere (Safari, Firefox, Chrome on Windows and Linux) the same API from `barcode-detector` on ZXing
// WebAssembly, loaded only then. Its .wasm is served from this site: the package's default is a CDN, which the CSP
// refuses anyway.

import type { BarcodeDetector as Ponyfill } from 'barcode-detector/ponyfill';

export interface QrDetector {
  /** The text of every QR code in the current frame. */
  detect(source: HTMLVideoElement): Promise<string[]>;
}

type DetectorClass = typeof Ponyfill;

function wrap(Detector: DetectorClass): QrDetector {
  const detector = new Detector({ formats: ['qr_code'] });
  return {
    detect: async (source) => (await detector.detect(source)).map((code) => code.rawValue),
  };
}

async function nativeDetector(): Promise<DetectorClass | undefined> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native === undefined) return undefined;
  try {
    return (await Native.getSupportedFormats()).includes('qr_code') ? Native : undefined;
  } catch {
    return undefined;
  }
}

export async function createQrDetector(): Promise<QrDetector> {
  const Native = await nativeDetector();
  if (Native !== undefined) return wrap(Native);
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  });
  return wrap(BarcodeDetector);
}

export type CameraError = 'denied' | 'no_camera' | 'unavailable';

/** The rear camera when there is one (phones), else whichever the browser picks (laptops). */
export async function openCamera(): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia === undefined) throw new Error('no getUserMedia');
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  });
}

export function cameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no_camera';
  return navigator.mediaDevices?.getUserMedia === undefined ? 'no_camera' : 'unavailable';
}
